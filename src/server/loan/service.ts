import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import {
  HOLDING_STATUSES,
  itemVariants,
  items,
  loanItems,
  loanProofs,
  loans,
  notifications,
} from "@/lib/db/schema";
import type { LoanLineInput } from "@/lib/validation/loans";
import { computeAvailable } from "@/server/catalog/availability";

/**
 * Loan service — SATU-SATUNYA penulis stok tertahan & transisi status (SDD
 * invariant #5 / *Component Map*). Owner `loans`, `loan_items`, `loan_proofs`.
 * Ketersediaan dihitung (`computeAvailable`), tak pernah disimpan.
 *
 * Sprint 02 mengirim jalur *checkout publik* saja:
 *  - DIRECT  → status ACTIVE, stok tertahan seketika, bukti CHECKOUT (SDD Flow 1).
 *  - BOOKING → status PENDING, stok BELUM ditahan, tanpa bukti (SDD Flow 2).
 *
 * Transisi admin (approve/activate/return) menyusul Sprint 03.
 *
 * DB di-inject (seperti Catalog service) agar dapat diuji atas Postgres uji
 * (pglite) maupun Postgres nyata (uji konkurensi `SELECT … FOR UPDATE`).
 */
export type LoanDb = PostgresJsDatabase<typeof schema>;
type Tx = Parameters<Parameters<LoanDb["transaction"]>[0]>[0];

/** Error domain Loan — dipetakan route ke amplop HTTP (SDD Error Handling). */
export class LoanError extends Error {
  constructor(
    public readonly code: "CONFLICT" | "NOT_FOUND" | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "LoanError";
  }
}

export interface CreateBookingInput {
  borrowerName: string;
  borrowerUnit: string;
  plannedDate: string; // ISO YYYY-MM-DD (pembeda booking)
  note?: string | null;
  lines: LoanLineInput[];
}

export interface CreateDirectLoanInput {
  borrowerName: string;
  borrowerUnit: string;
  note?: string | null;
  lines: LoanLineInput[];
  /** Bukti CHECKOUT wajib (sudah tersimpan di Storage oleh route). */
  proof: { storageKey: string; mime: string; sizeBytes: number };
}

export interface CreateLoanResult {
  loanId: number;
  type: "DIRECT" | "BOOKING";
  status: "ACTIVE" | "PENDING";
}

/** Kunci baris loan (`FOR UPDATE`) → serialkan transisi per-peminjaman. */
async function loadLoanForUpdate(tx: Tx, loanId: number) {
  const [loan] = await tx.select().from(loans).where(eq(loans.id, loanId)).for("update");
  if (!loan) throw new LoanError("NOT_FOUND", `Peminjaman ${loanId} tidak ditemukan.`);
  return loan;
}

/** Σ(quantity − quantity_returned) yang menahan stok untuk sebuah baris stok. */
async function heldFor(
  tx: Tx,
  ref: { itemId: number; variantId?: number | null },
): Promise<number> {
  const match =
    ref.variantId != null
      ? eq(loanItems.variantId, ref.variantId)
      : and(eq(loanItems.itemId, ref.itemId), isNull(loanItems.variantId));

  const [row] = await tx
    .select({
      held: sql<number>`coalesce(sum(${loanItems.quantity} - ${loanItems.quantityReturned}), 0)::int`,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loanItems.loanId, loans.id))
    .where(and(match, inArray(loans.status, [...HOLDING_STATUSES])));

  return row?.held ?? 0;
}

/**
 * Kunci baris stok (`FOR UPDATE`), lalu tegakkan `available >= quantity`.
 * Penguncian mencegah oversell dua checkout bersamaan: transaksi kedua menunggu
 * commit pertama, lalu melihat stok tertahan yang sudah diperbarui (SDD
 * *Konkurensi* / Technical Risks). Melempar `LoanError` bila kurang / tak ada.
 */
async function lockAndAssertAvailable(tx: Tx, line: LoanLineInput): Promise<void> {
  if (line.variantId != null) {
    const [variant] = await tx
      .select()
      .from(itemVariants)
      .where(eq(itemVariants.id, line.variantId))
      .for("update");
    if (!variant) throw new LoanError("NOT_FOUND", `Varian ${line.variantId} tidak ditemukan.`);
    const held = await heldFor(tx, { itemId: line.itemId, variantId: line.variantId });
    if (computeAvailable(variant.stockTotal, held) < line.quantity) {
      throw new LoanError(
        "CONFLICT",
        `Stok "${variant.name}" tidak mencukupi. Kurangi jumlah atau pilih barang lain.`,
      );
    }
  } else {
    const [item] = await tx
      .select()
      .from(items)
      .where(eq(items.id, line.itemId))
      .for("update");
    if (!item) throw new LoanError("NOT_FOUND", `Barang ${line.itemId} tidak ditemukan.`);
    const held = await heldFor(tx, { itemId: line.itemId, variantId: null });
    if (computeAvailable(item.stockTotal, held) < line.quantity) {
      throw new LoanError(
        "CONFLICT",
        `Stok "${item.name}" tidak mencukupi. Kurangi jumlah atau pilih barang lain.`,
      );
    }
  }
}

/** Pastikan barang/varian yang direferensikan ada (booking tak mengunci stok). */
async function assertLineExists(tx: Tx, line: LoanLineInput): Promise<void> {
  if (line.variantId != null) {
    const [v] = await tx
      .select({ id: itemVariants.id })
      .from(itemVariants)
      .where(eq(itemVariants.id, line.variantId));
    if (!v) throw new LoanError("NOT_FOUND", `Varian ${line.variantId} tidak ditemukan.`);
  } else {
    const [it] = await tx.select({ id: items.id }).from(items).where(eq(items.id, line.itemId));
    if (!it) throw new LoanError("NOT_FOUND", `Barang ${line.itemId} tidak ditemukan.`);
  }
}

/**
 * Peminjaman LANGSUNG (DIRECT) — stok tertahan seketika (status ACTIVE), bukti
 * CHECKOUT direkam dalam transaksi yang sama. Semua baris dikunci & divalidasi
 * sebelum insert; bila salah satu kurang stok, seluruh transaksi rollback
 * (tak ada peminjaman parsial). SDD Flow 1.
 */
export async function createDirectLoan(
  db: LoanDb,
  input: CreateDirectLoanInput,
): Promise<CreateLoanResult> {
  return db.transaction(async (tx) => {
    for (const line of input.lines) {
      await lockAndAssertAvailable(tx, line);
    }

    const [loan] = await tx
      .insert(loans)
      .values({
        borrowerName: input.borrowerName,
        borrowerUnit: input.borrowerUnit,
        type: "DIRECT",
        status: "ACTIVE",
        plannedDate: null,
        note: input.note ?? null,
        activatedAt: new Date(),
      })
      .returning();

    await tx.insert(loanItems).values(
      input.lines.map((l) => ({
        loanId: loan.id,
        itemId: l.itemId,
        variantId: l.variantId ?? null,
        quantity: l.quantity,
      })),
    );

    await tx.insert(loanProofs).values({
      loanId: loan.id,
      storageKey: input.proof.storageKey,
      mime: input.proof.mime,
      sizeBytes: input.proof.sizeBytes,
      kind: "CHECKOUT",
    });

    return { loanId: loan.id, type: "DIRECT", status: "ACTIVE" };
  });
}

/**
 * BOOKING — status PENDING, stok BELUM ditahan (baru ditahan saat admin approve,
 * Sprint 03). Tanpa bukti saat pengajuan (UX-011). Membuat notifikasi in-app
 * "booking baru" untuk admin (SDD Flow 2 / ADR-010 polling). SDD Flow 2.
 */
export async function createBooking(
  db: LoanDb,
  input: CreateBookingInput,
): Promise<CreateLoanResult> {
  return db.transaction(async (tx) => {
    for (const line of input.lines) {
      await assertLineExists(tx, line);
    }

    const [loan] = await tx
      .insert(loans)
      .values({
        borrowerName: input.borrowerName,
        borrowerUnit: input.borrowerUnit,
        type: "BOOKING",
        status: "PENDING",
        plannedDate: input.plannedDate,
        note: input.note ?? null,
      })
      .returning();

    await tx.insert(loanItems).values(
      input.lines.map((l) => ({
        loanId: loan.id,
        itemId: l.itemId,
        variantId: l.variantId ?? null,
        quantity: l.quantity,
      })),
    );

    await tx.insert(notifications).values({
      type: "BOOKING_NEW",
      message: `Booking baru dari ${input.borrowerName} (${input.borrowerUnit}).`,
      loanId: loan.id,
    });

    return { loanId: loan.id, type: "BOOKING", status: "PENDING" };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Transisi ADMIN (Sprint 03) — state machine SDD *Data Design*:
//   BOOKING: PENDING ─approve─► RESERVED ─activate(+PICKUP)─► ACTIVE ─return─► RETURNED
//                       └reject─► REJECTED       └cancel─► CANCELLED
//   DIRECT : ACTIVE ─return(sebagian/penuh)─► (ACTIVE|RETURNED)
// Loan service tetap satu-satunya penulis status/stok (SDD invariant #5).
// ────────────────────────────────────────────────────────────────────────────

export interface AdminProofInput {
  storageKey: string;
  mime: string;
  sizeBytes: number;
}

/** Muat baris peminjaman (opsional dikunci) — dipakai transisi & return. */
async function loadLines(tx: Tx, loanId: number) {
  return tx.select().from(loanItems).where(eq(loanItems.loanId, loanId));
}

/**
 * Setujui booking: PENDING → RESERVED, **menahan stok** (SDD Flow 2). Tiap
 * baris dikunci (`FOR UPDATE`) & divalidasi `available >= quantity` sebelum
 * commit — dua approve bersamaan atas stok terbatas tak pernah oversell
 * (PPD D4, konkurensi approve). Loan dikunci → double-approve aman.
 */
export async function approveBooking(db: LoanDb, loanId: number): Promise<void> {
  return db.transaction(async (tx) => {
    const loan = await loadLoanForUpdate(tx, loanId);
    if (loan.status !== "PENDING") {
      throw new LoanError("CONFLICT", "Hanya booking berstatus Menunggu yang bisa disetujui.");
    }
    const lines = await loadLines(tx, loanId);
    for (const l of lines) {
      await lockAndAssertAvailable(tx, {
        itemId: l.itemId,
        variantId: l.variantId,
        quantity: l.quantity,
      });
    }
    await tx
      .update(loans)
      .set({ status: "RESERVED", decidedAt: new Date() })
      .where(eq(loans.id, loanId));
  });
}

/** Tolak booking: PENDING → REJECTED, tanpa efek stok (SDD Flow 2). */
export async function rejectBooking(db: LoanDb, loanId: number): Promise<void> {
  return db.transaction(async (tx) => {
    const loan = await loadLoanForUpdate(tx, loanId);
    if (loan.status !== "PENDING") {
      throw new LoanError("CONFLICT", "Hanya booking berstatus Menunggu yang bisa ditolak.");
    }
    await tx
      .update(loans)
      .set({ status: "REJECTED", decidedAt: new Date() })
      .where(eq(loans.id, loanId));
  });
}

/**
 * Batalkan booking yang sudah disetujui: RESERVED → CANCELLED. Stok kembali
 * otomatis (CANCELLED bukan status penahan — invariant ketersediaan).
 */
export async function cancelLoan(db: LoanDb, loanId: number): Promise<void> {
  return db.transaction(async (tx) => {
    const loan = await loadLoanForUpdate(tx, loanId);
    if (loan.status !== "RESERVED") {
      throw new LoanError("CONFLICT", "Hanya reservasi (Akan) yang bisa dibatalkan.");
    }
    await tx
      .update(loans)
      .set({ status: "CANCELLED", decidedAt: new Date() })
      .where(eq(loans.id, loanId));
  });
}

/**
 * Serah-terima booking (pickup): RESERVED → ACTIVE, rekam bukti PICKUP dalam
 * satu transaksi (SDD Flow 2 / DSD UX-011). Stok tak berubah (RESERVED & ACTIVE
 * sama-sama menahan). Bukti wajib ditegakkan di route (file) & di sini (param).
 */
export async function activateLoan(
  db: LoanDb,
  loanId: number,
  proof: AdminProofInput,
): Promise<void> {
  return db.transaction(async (tx) => {
    const loan = await loadLoanForUpdate(tx, loanId);
    if (loan.status !== "RESERVED") {
      throw new LoanError("CONFLICT", "Hanya reservasi (Akan) yang bisa ditandai Diambil.");
    }
    await tx.insert(loanProofs).values({
      loanId,
      storageKey: proof.storageKey,
      mime: proof.mime,
      sizeBytes: proof.sizeBytes,
      kind: "PICKUP",
    });
    await tx
      .update(loans)
      .set({ status: "ACTIVE", activatedAt: new Date() })
      .where(eq(loans.id, loanId));
  });
}

/**
 * Pengembalian sebagian/penuh sebuah baris (FR9). Menaikkan `quantity_returned`
 * (stok kembali sebesar itu — invariant). Loan menjadi RETURNED hanya bila
 * **semua** baris `quantity_returned == quantity`.
 */
export async function returnLine(
  db: LoanDb,
  loanId: number,
  lineId: number,
  quantity: number,
): Promise<void> {
  return db.transaction(async (tx) => {
    const loan = await loadLoanForUpdate(tx, loanId);
    if (loan.status !== "ACTIVE") {
      throw new LoanError("CONFLICT", "Hanya peminjaman aktif (Sedang) yang bisa dikembalikan.");
    }
    const [line] = await tx
      .select()
      .from(loanItems)
      .where(and(eq(loanItems.id, lineId), eq(loanItems.loanId, loanId)));
    if (!line) throw new LoanError("NOT_FOUND", `Baris peminjaman ${lineId} tidak ditemukan.`);

    const remaining = line.quantity - line.quantityReturned;
    if (quantity < 1 || quantity > remaining) {
      throw new LoanError("VALIDATION", `Jumlah kembali harus antara 1 dan ${remaining}.`);
    }

    const newReturned = line.quantityReturned + quantity;
    await tx
      .update(loanItems)
      .set({ quantityReturned: newReturned })
      .where(eq(loanItems.id, lineId));

    const lines = await loadLines(tx, loanId);
    const allReturned = lines.every((l) =>
      l.id === lineId ? newReturned >= l.quantity : l.quantityReturned >= l.quantity,
    );
    if (allReturned) {
      await tx
        .update(loans)
        .set({ status: "RETURNED", returnedAt: new Date() })
        .where(eq(loans.id, loanId));
    }
  });
}

/**
 * Batalkan (undo) pengembalian terakhir sebuah baris (DSD F4, jendela ~5 dtk).
 * Menurunkan `quantity_returned` → **menahan lagi stok**; karena itu baris stok
 * dikunci & divalidasi `available >= quantity` (bisa saja stok yang terlanjur
 * bebas sudah diambil peminjam lain → CONFLICT). Bila loan sudah RETURNED,
 * dikembalikan ke ACTIVE.
 */
export async function undoReturn(
  db: LoanDb,
  loanId: number,
  lineId: number,
  quantity: number,
): Promise<void> {
  return db.transaction(async (tx) => {
    const loan = await loadLoanForUpdate(tx, loanId);
    if (loan.status !== "ACTIVE" && loan.status !== "RETURNED") {
      throw new LoanError("CONFLICT", "Undo hanya untuk peminjaman aktif/telah dikembalikan.");
    }
    const [line] = await tx
      .select()
      .from(loanItems)
      .where(and(eq(loanItems.id, lineId), eq(loanItems.loanId, loanId)));
    if (!line) throw new LoanError("NOT_FOUND", `Baris peminjaman ${lineId} tidak ditemukan.`);

    if (quantity < 1 || quantity > line.quantityReturned) {
      throw new LoanError("VALIDATION", `Tak ada pengembalian sebanyak ${quantity} untuk diurungkan.`);
    }

    // Menahan lagi `quantity`: pastikan masih tersedia (hindari oversell).
    await lockAndAssertAvailable(tx, {
      itemId: line.itemId,
      variantId: line.variantId,
      quantity,
    });

    await tx
      .update(loanItems)
      .set({ quantityReturned: line.quantityReturned - quantity })
      .where(eq(loanItems.id, lineId));

    if (loan.status === "RETURNED") {
      await tx
        .update(loans)
        .set({ status: "ACTIVE", returnedAt: null })
        .where(eq(loans.id, loanId));
    }
  });
}

/**
 * Koreksi jumlah sebuah baris **hanya saat PENDING** (sebelum approve, DSD F3).
 * Ditolak `CONFLICT` bila status ≠ PENDING. PENDING belum menahan stok →
 * validasi ketersediaan terjadi saat approve.
 */
export async function patchLineQuantity(
  db: LoanDb,
  loanId: number,
  lineId: number,
  quantity: number,
): Promise<void> {
  return db.transaction(async (tx) => {
    const loan = await loadLoanForUpdate(tx, loanId);
    if (loan.status !== "PENDING") {
      throw new LoanError("CONFLICT", "Jumlah hanya bisa diubah sebelum booking disetujui.");
    }
    if (quantity < 1) throw new LoanError("VALIDATION", "Jumlah minimal 1.");
    const [line] = await tx
      .select({ id: loanItems.id })
      .from(loanItems)
      .where(and(eq(loanItems.id, lineId), eq(loanItems.loanId, loanId)));
    if (!line) throw new LoanError("NOT_FOUND", `Baris peminjaman ${lineId} tidak ditemukan.`);
    await tx.update(loanItems).set({ quantity }).where(eq(loanItems.id, lineId));
  });
}

/**
 * Hapus metadata bukti (loan service owner `loan_proofs`). Mengembalikan
 * `storageKey` agar route menghapus blob-nya (SDD: hapus DB dulu → blob;
 * orphan ditolerir). NOT_FOUND bila bukti tak ada.
 */
export async function deleteProof(db: LoanDb, proofId: number): Promise<{ storageKey: string }> {
  const [proof] = await db.select().from(loanProofs).where(eq(loanProofs.id, proofId));
  if (!proof) throw new LoanError("NOT_FOUND", "Bukti tidak ditemukan.");
  await db.delete(loanProofs).where(eq(loanProofs.id, proofId));
  return { storageKey: proof.storageKey };
}
