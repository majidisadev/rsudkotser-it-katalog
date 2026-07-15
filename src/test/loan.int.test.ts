import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { categories, items, loanProofs, loans, notifications } from "@/lib/db/schema";
import { listItems, type CatalogDb } from "@/server/catalog/service";
import {
  LoanError,
  createBooking,
  createDirectLoan,
  type LoanDb,
} from "@/server/loan/service";

/**
 * Integration Loan service atas Postgres uji (pglite) — membuktikan invariant
 * stok lewat DB nyata (S2.1). Uji konkurensi `FOR UPDATE` sesungguhnya butuh
 * banyak koneksi → lihat `loan.concurrency.int.test.ts` (Postgres nyata, gated).
 */
let db: LoanDb & CatalogDb;
let projId: number;

async function availableOf(name: string): Promise<number> {
  const { items: rows } = await listItems(db, {}, { enableVariants: false });
  return rows.find((r) => r.name === name)?.available ?? -1;
}

beforeAll(async () => {
  const client = new PGlite();
  const drizzleDb = drizzle(client, { schema });
  await migrate(drizzleDb, { migrationsFolder: "drizzle" });
  db = drizzleDb as unknown as LoanDb & CatalogDb;

  const [cat] = await drizzleDb.insert(categories).values({ name: "Presentasi" }).returning();
  const [proj] = await drizzleDb
    .insert(items)
    .values({ name: "Proyektor", categoryId: cat.id, stockTotal: 2 })
    .returning();
  projId = proj.id;
});

describe("Loan service — checkout (S2.1)", () => {
  it("DIRECT → ACTIVE, menahan stok seketika + bukti CHECKOUT", async () => {
    expect(await availableOf("Proyektor")).toBe(2);

    const res = await createDirectLoan(db, {
      borrowerName: "Sinta",
      borrowerUnit: "Anak",
      lines: [{ itemId: projId, quantity: 1 }],
      proof: { storageKey: "k1.webp", mime: "image/webp", sizeBytes: 100 },
    });

    expect(res).toMatchObject({ type: "DIRECT", status: "ACTIVE" });
    // stok 2 − 1 tertahan = 1.
    expect(await availableOf("Proyektor")).toBe(1);

    const [loan] = await db.select().from(loans).where(eq(loans.id, res.loanId));
    expect(loan.status).toBe("ACTIVE");
    expect(loan.activatedAt).not.toBeNull();

    const proofs = await db.select().from(loanProofs).where(eq(loanProofs.loanId, res.loanId));
    expect(proofs).toHaveLength(1);
    expect(proofs[0].kind).toBe("CHECKOUT");
  });

  it("BOOKING → PENDING, TIDAK menahan stok + notifikasi in-app", async () => {
    const before = await availableOf("Proyektor");

    const res = await createBooking(db, {
      borrowerName: "Budi",
      borrowerUnit: "Radiologi",
      plannedDate: "2026-07-25",
      lines: [{ itemId: projId, quantity: 1 }],
    });

    expect(res).toMatchObject({ type: "BOOKING", status: "PENDING" });
    // PENDING tidak menahan → ketersediaan tak berubah.
    expect(await availableOf("Proyektor")).toBe(before);

    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.loanId, res.loanId));
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("BOOKING_NEW");
    expect(notifs[0].isRead).toBe(false);
  });

  it("oversell ditolak (CONFLICT) & rollback penuh — tak ada peminjaman parsial", async () => {
    // Tersisa 1 (stok 2 − 1 ACTIVE dari test pertama). Minta 2 → gagal.
    const avail = await availableOf("Proyektor");
    expect(avail).toBe(1);

    const [{ count: before }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans);

    await expect(
      createDirectLoan(db, {
        borrowerName: "Rina",
        borrowerUnit: "Farmasi",
        lines: [{ itemId: projId, quantity: 2 }],
        proof: { storageKey: "k2.webp", mime: "image/webp", sizeBytes: 100 },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const [{ count: after }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans);
    expect(after).toBe(before); // rollback: tak ada loan baru
    expect(await availableOf("Proyektor")).toBe(avail); // stok tak berubah
  });

  it("barang tak ada → NOT_FOUND", async () => {
    await expect(
      createBooking(db, {
        borrowerName: "X",
        borrowerUnit: "U",
        plannedDate: "2026-07-25",
        lines: [{ itemId: 99999, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(LoanError);
  });
});
