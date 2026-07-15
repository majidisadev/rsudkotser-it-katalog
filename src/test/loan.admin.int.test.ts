import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { categories, items, loanItems, loanProofs, loans } from "@/lib/db/schema";
import { listItems, type CatalogDb } from "@/server/catalog/service";
import {
  activateLoan,
  approveBooking,
  cancelLoan,
  createBooking,
  createDirectLoan,
  LoanError,
  patchLineQuantity,
  rejectBooking,
  returnLine,
  undoReturn,
  type LoanDb,
} from "@/server/loan/service";

/**
 * Integration transisi admin Loan service (S3.2) atas pglite — membuktikan
 * state machine SDD & invariant stok lewat DB nyata. Uji konkurensi approve
 * (`FOR UPDATE`) sesungguhnya butuh banyak koneksi → `loan.approve.concurrency.int.test.ts`.
 */
let db: LoanDb & CatalogDb;
let catId: number;

async function newItem(name: string, stock: number): Promise<number> {
  const [it] = await db.insert(items).values({ name, categoryId: catId, stockTotal: stock }).returning();
  return it.id;
}
async function availableOf(name: string): Promise<number> {
  const { items: rows } = await listItems(db, {}, { enableVariants: false });
  return rows.find((r) => r.name === name)?.available ?? -1;
}
async function statusOf(loanId: number) {
  const [l] = await db.select().from(loans).where(eq(loans.id, loanId));
  return l.status;
}

beforeAll(async () => {
  const client = new PGlite();
  const drizzleDb = drizzle(client, { schema });
  await migrate(drizzleDb, { migrationsFolder: "drizzle" });
  db = drizzleDb as unknown as LoanDb & CatalogDb;
  const [cat] = await drizzleDb.insert(categories).values({ name: "Presentasi" }).returning();
  catId = cat.id;
});

describe("Loan admin transitions (S3.2)", () => {
  it("approve booking → RESERVED, menahan stok (SDD Flow 2)", async () => {
    const itemId = await newItem("Approve-Item", 2);
    const { loanId } = await createBooking(db, {
      borrowerName: "Sinta",
      borrowerUnit: "Anak",
      plannedDate: "2026-07-25",
      lines: [{ itemId, quantity: 2 }],
    });
    expect(await availableOf("Approve-Item")).toBe(2); // PENDING belum menahan

    await approveBooking(db, loanId);
    expect(await statusOf(loanId)).toBe("RESERVED");
    expect(await availableOf("Approve-Item")).toBe(0); // RESERVED menahan
  });

  it("approve gagal bila stok tak cukup → CONFLICT + tetap PENDING", async () => {
    const itemId = await newItem("Approve-Short", 1);
    // Tahan 1 lewat peminjaman langsung.
    await createDirectLoan(db, {
      borrowerName: "A",
      borrowerUnit: "U",
      lines: [{ itemId, quantity: 1 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    const { loanId } = await createBooking(db, {
      borrowerName: "B",
      borrowerUnit: "U",
      plannedDate: "2026-07-25",
      lines: [{ itemId, quantity: 1 }],
    });
    await expect(approveBooking(db, loanId)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await statusOf(loanId)).toBe("PENDING");
  });

  it("reject booking → REJECTED, tanpa efek stok", async () => {
    const itemId = await newItem("Reject-Item", 3);
    const { loanId } = await createBooking(db, {
      borrowerName: "C",
      borrowerUnit: "U",
      plannedDate: "2026-07-25",
      lines: [{ itemId, quantity: 2 }],
    });
    await rejectBooking(db, loanId);
    expect(await statusOf(loanId)).toBe("REJECTED");
    expect(await availableOf("Reject-Item")).toBe(3);
  });

  it("cancel RESERVED → CANCELLED, stok kembali", async () => {
    const itemId = await newItem("Cancel-Item", 2);
    const { loanId } = await createBooking(db, {
      borrowerName: "D",
      borrowerUnit: "U",
      plannedDate: "2026-07-25",
      lines: [{ itemId, quantity: 2 }],
    });
    await approveBooking(db, loanId);
    expect(await availableOf("Cancel-Item")).toBe(0);
    await cancelLoan(db, loanId);
    expect(await statusOf(loanId)).toBe("CANCELLED");
    expect(await availableOf("Cancel-Item")).toBe(2);
  });

  it("activate RESERVED → ACTIVE + bukti PICKUP (DSD UX-011)", async () => {
    const itemId = await newItem("Pickup-Item", 2);
    const { loanId } = await createBooking(db, {
      borrowerName: "E",
      borrowerUnit: "U",
      plannedDate: "2026-07-25",
      lines: [{ itemId, quantity: 1 }],
    });
    await approveBooking(db, loanId);
    await activateLoan(db, loanId, { storageKey: "pickup.webp", mime: "image/webp", sizeBytes: 10 });
    expect(await statusOf(loanId)).toBe("ACTIVE");
    const proofs = await db.select().from(loanProofs).where(eq(loanProofs.loanId, loanId));
    expect(proofs).toHaveLength(1);
    expect(proofs[0].kind).toBe("PICKUP");
    expect(await availableOf("Pickup-Item")).toBe(1); // RESERVED→ACTIVE sama-sama menahan
  });

  it("return sebagian tetap ACTIVE; return sisa → RETURNED; stok kembali bertahap", async () => {
    const itemId = await newItem("Return-Item", 5);
    const { loanId } = await createDirectLoan(db, {
      borrowerName: "F",
      borrowerUnit: "U",
      lines: [{ itemId, quantity: 3 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    expect(await availableOf("Return-Item")).toBe(2); // 5 − 3
    const [line] = await db.select().from(loanItems).where(eq(loanItems.loanId, loanId));

    await returnLine(db, loanId, line.id, 1);
    expect(await statusOf(loanId)).toBe("ACTIVE");
    expect(await availableOf("Return-Item")).toBe(3); // +1

    await returnLine(db, loanId, line.id, 2);
    expect(await statusOf(loanId)).toBe("RETURNED");
    expect(await availableOf("Return-Item")).toBe(5); // penuh
  });

  it("return melebihi sisa → VALIDATION", async () => {
    const itemId = await newItem("Return-Guard", 2);
    const { loanId } = await createDirectLoan(db, {
      borrowerName: "G",
      borrowerUnit: "U",
      lines: [{ itemId, quantity: 1 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    const [line] = await db.select().from(loanItems).where(eq(loanItems.loanId, loanId));
    await expect(returnLine(db, loanId, line.id, 2)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("undo return → menahan lagi stok; RETURNED kembali ACTIVE", async () => {
    const itemId = await newItem("Undo-Item", 2);
    const { loanId } = await createDirectLoan(db, {
      borrowerName: "H",
      borrowerUnit: "U",
      lines: [{ itemId, quantity: 1 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    const [line] = await db.select().from(loanItems).where(eq(loanItems.loanId, loanId));
    await returnLine(db, loanId, line.id, 1);
    expect(await statusOf(loanId)).toBe("RETURNED");
    expect(await availableOf("Undo-Item")).toBe(2);

    await undoReturn(db, loanId, line.id, 1);
    expect(await statusOf(loanId)).toBe("ACTIVE");
    expect(await availableOf("Undo-Item")).toBe(1); // ditahan lagi
  });

  it("undo gagal bila stok yang bebas sudah diambil pihak lain → CONFLICT", async () => {
    const itemId = await newItem("Undo-Conflict", 1);
    const direct = await createDirectLoan(db, {
      borrowerName: "I",
      borrowerUnit: "U",
      lines: [{ itemId, quantity: 1 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    const [line] = await db.select().from(loanItems).where(eq(loanItems.loanId, direct.loanId));
    await returnLine(db, direct.loanId, line.id, 1); // stok bebas
    // Peminjam lain mengambil satu-satunya stok.
    await createDirectLoan(db, {
      borrowerName: "J",
      borrowerUnit: "U",
      lines: [{ itemId, quantity: 1 }],
      proof: { storageKey: "k2.webp", mime: "image/webp", sizeBytes: 1 },
    });
    await expect(undoReturn(db, direct.loanId, line.id, 1)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("patch line quantity hanya saat PENDING; ditolak setelah approve", async () => {
    const itemId = await newItem("Patch-Item", 5);
    const { loanId } = await createBooking(db, {
      borrowerName: "K",
      borrowerUnit: "U",
      plannedDate: "2026-07-25",
      lines: [{ itemId, quantity: 2 }],
    });
    const [line] = await db.select().from(loanItems).where(eq(loanItems.loanId, loanId));
    await patchLineQuantity(db, loanId, line.id, 3);
    const [updated] = await db.select().from(loanItems).where(eq(loanItems.id, line.id));
    expect(updated.quantity).toBe(3);

    await approveBooking(db, loanId);
    await expect(patchLineQuantity(db, loanId, line.id, 4)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("transisi atas loan tak ada → NOT_FOUND", async () => {
    await expect(approveBooking(db, 999999)).rejects.toBeInstanceOf(LoanError);
    await expect(approveBooking(db, 999999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
