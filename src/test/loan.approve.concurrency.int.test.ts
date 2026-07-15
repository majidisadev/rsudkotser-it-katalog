import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { items, loans } from "@/lib/db/schema";
import {
  approveBooking,
  createBooking,
  LoanError,
  type LoanDb,
} from "@/server/loan/service";

/**
 * Uji konkurensi **approve** atas Postgres nyata (PPD D4 — perluasan Sprint 03).
 * Dua booking PENDING atas stok = 1 disetujui bersamaan → tepat SATU menjadi
 * RESERVED, satu CONFLICT. Membuktikan guard `SELECT … FOR UPDATE` juga menahan
 * oversell pada jalur approve (bukan hanya create DIRECT). pglite tak bisa
 * membuktikan lock (single-connection).
 *
 * **Gated**: berjalan bila `DATABASE_URL` ada; absen → di-skip (bukan gagal).
 */
try {
  (process as NodeJS.Process & { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  /* .env tak ada (CI) — pakai process.env apa adanya. */
}

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Loan approve — konkurensi FOR UPDATE (S3.2, Postgres nyata)", () => {
  let client: ReturnType<typeof postgres>;
  let db: LoanDb;
  let itemId: number;
  const unit = `__aptest_${Date.now()}`;

  beforeAll(async () => {
    client = postgres(DATABASE_URL!, { max: 5, prepare: false });
    db = drizzle(client, { schema }) as unknown as LoanDb;
    const [it] = await db
      .insert(items)
      .values({ name: `__approve_conc_${Date.now()}`, stockTotal: 1 })
      .returning();
    itemId = it.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(loans).where(eq(loans.borrowerUnit, unit));
      await db.delete(items).where(eq(items.id, itemId));
    }
    await client?.end();
  });

  it("dua approve bersamaan atas stok=1 → satu RESERVED, satu CONFLICT", async () => {
    const a = await createBooking(db, {
      borrowerName: "A",
      borrowerUnit: unit,
      plannedDate: "2026-07-30",
      lines: [{ itemId, quantity: 1 }],
    });
    const b = await createBooking(db, {
      borrowerName: "B",
      borrowerUnit: unit,
      plannedDate: "2026-07-30",
      lines: [{ itemId, quantity: 1 }],
    });

    const results = await Promise.allSettled([
      approveBooking(db, a.loanId),
      approveBooking(db, b.loanId),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(LoanError);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe("CONFLICT");

    // Tepat satu RESERVED di DB.
    const rows = await db
      .select({ status: loans.status })
      .from(loans)
      .where(inArray(loans.id, [a.loanId, b.loanId]));
    expect(rows.filter((r) => r.status === "RESERVED")).toHaveLength(1);
    expect(rows.filter((r) => r.status === "PENDING")).toHaveLength(1);
  });
});
