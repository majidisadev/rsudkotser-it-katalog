import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { items, loans } from "@/lib/db/schema";
import { LoanError, createDirectLoan, type LoanDb } from "@/server/loan/service";

/**
 * Uji konkurensi stok atas **Postgres nyata** (bukan pglite — single-connection
 * tak bisa membuktikan `SELECT … FOR UPDATE`). Membuktikan guard transaksional:
 * dua checkout DIRECT bersamaan atas stok = 1 → tepat SATU sukses, satu CONFLICT
 * (PPD D4 — AC eksplisit Sprint 02; SDD *Technical Risks* oversell).
 *
 * **Gated**: berjalan bila `DATABASE_URL` tersedia (CI menyediakan Postgres +
 * migrasi; lokal memuat `.env`). Absen → di-skip (bukan gagal).
 */
try {
  // Node ≥21: memuat .env untuk run lokal (CI sudah menaruh DATABASE_URL di env).
  (process as NodeJS.Process & { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  /* .env tak ada (mis. CI) — pakai process.env apa adanya. */
}

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("Loan service — konkurensi FOR UPDATE (S2.1, Postgres nyata)", () => {
  let client: ReturnType<typeof postgres>;
  let db: LoanDb;
  let itemId: number;

  beforeAll(async () => {
    client = postgres(DATABASE_URL!, { max: 5, prepare: false });
    db = drizzle(client, { schema }) as unknown as LoanDb;

    const [it] = await db
      .insert(items)
      .values({ name: `__concurrency_test_${Date.now()}`, stockTotal: 1 })
      .returning();
    itemId = it.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(loans).where(eq(loans.borrowerUnit, `__ctest_${itemId}`));
      await db.delete(items).where(eq(items.id, itemId));
    }
    await client?.end();
  });

  it("dua DIRECT bersamaan atas stok=1 → satu 201, satu CONFLICT", async () => {
    const attempt = (who: string) =>
      createDirectLoan(db, {
        borrowerName: who,
        borrowerUnit: `__ctest_${itemId}`,
        lines: [{ itemId, quantity: 1 }],
        proof: { storageKey: `${who}.webp`, mime: "image/webp", sizeBytes: 100 },
      });

    const results = await Promise.allSettled([attempt("A"), attempt("B")]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(LoanError);
    expect(err.code).toBe("CONFLICT");
  });
});
