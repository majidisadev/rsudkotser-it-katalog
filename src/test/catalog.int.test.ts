import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { categories, itemVariants, items, loanItems, loans } from "@/lib/db/schema";
import { listItems, type CatalogDb } from "@/server/catalog/service";

/**
 * Integration test atas Postgres uji (pglite) — membuktikan invariant stok
 * lewat DB nyata (S1.4 AC2/AC3/AC4). Menjalankan migrasi dari folder drizzle/,
 * jadi bergantung pada `pnpm db:generate` sudah dijalankan.
 */
let db: CatalogDb;
let presentasiId: number;

beforeAll(async () => {
  const client = new PGlite();
  const drizzleDb = drizzle(client, { schema });
  await migrate(drizzleDb, { migrationsFolder: "drizzle" });
  db = drizzleDb as unknown as CatalogDb;

  const [presentasi] = await drizzleDb
    .insert(categories)
    .values({ name: "Presentasi" })
    .returning();
  presentasiId = presentasi.id;

  const [proj] = await drizzleDb
    .insert(items)
    .values({ name: "Proyektor Epson", categoryId: presentasi.id, stockTotal: 3 })
    .returning();

  await drizzleDb.insert(items).values({ name: "Laptop Lenovo", stockTotal: 5 });

  // RESERVED menahan 1; ACTIVE menahan 1 (returned 0). → proyektor held = 2.
  const [reserved] = await drizzleDb
    .insert(loans)
    .values({ borrowerName: "A", borrowerUnit: "U", type: "BOOKING", status: "RESERVED" })
    .returning();
  await drizzleDb
    .insert(loanItems)
    .values({ loanId: reserved.id, itemId: proj.id, quantity: 1, quantityReturned: 0 });

  const [active] = await drizzleDb
    .insert(loans)
    .values({ borrowerName: "B", borrowerUnit: "U", type: "DIRECT", status: "ACTIVE" })
    .returning();
  await drizzleDb
    .insert(loanItems)
    .values({ loanId: active.id, itemId: proj.id, quantity: 1, quantityReturned: 0 });

  // RETURNED penuh → TIDAK menahan.
  const [returned] = await drizzleDb
    .insert(loans)
    .values({ borrowerName: "C", borrowerUnit: "U", type: "DIRECT", status: "RETURNED" })
    .returning();
  await drizzleDb
    .insert(loanItems)
    .values({ loanId: returned.id, itemId: proj.id, quantity: 2, quantityReturned: 2 });

  // PENDING → TIDAK menahan (booking belum disetujui).
  const [pending] = await drizzleDb
    .insert(loans)
    .values({ borrowerName: "D", borrowerUnit: "U", type: "BOOKING", status: "PENDING" })
    .returning();
  await drizzleDb
    .insert(loanItems)
    .values({ loanId: pending.id, itemId: proj.id, quantity: 2, quantityReturned: 0 });
});

describe("listItems + ketersediaan (S1.4)", () => {
  it("AC2 — hanya RESERVED+ACTIVE yang menahan stok", async () => {
    const { items: rows } = await listItems(db, {}, { enableVariants: false });
    const proj = rows.find((r) => r.name === "Proyektor Epson");
    // stok 3 − (reserved 1 + active 1) = 1; PENDING & RETURNED diabaikan.
    expect(proj?.available).toBe(1);
    const laptop = rows.find((r) => r.name === "Laptop Lenovo");
    expect(laptop?.available).toBe(5);
  });

  it("AC4 — filter q (case-insensitive) menyaring nama", async () => {
    const { items: rows } = await listItems(db, { q: "laptop" }, { enableVariants: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Laptop Lenovo");
  });

  it("AC4 — filter category", async () => {
    const { items: rows } = await listItems(
      db,
      { category: presentasiId },
      { enableVariants: false },
    );
    expect(rows.every((r) => r.categoryId === presentasiId)).toBe(true);
    expect(rows.some((r) => r.name === "Proyektor Epson")).toBe(true);
  });

  it("AC3 — ketersediaan per-varian saat ENABLE_VARIANTS", async () => {
    const [hub] = await (db as unknown as typeof db)
      .insert(items)
      .values({ name: "Docking Hub", hasVariants: true, stockTotal: 0 })
      .returning();
    const [usbc] = await db
      .insert(itemVariants)
      .values({ itemId: hub.id, name: "USB-C", stockTotal: 4 })
      .returning();
    // ACTIVE menahan 1 varian USB-C.
    const [ln] = await db
      .insert(loans)
      .values({ borrowerName: "E", borrowerUnit: "U", type: "DIRECT", status: "ACTIVE" })
      .returning();
    await db
      .insert(loanItems)
      .values({ loanId: ln.id, itemId: hub.id, variantId: usbc.id, quantity: 1, quantityReturned: 0 });

    const { items: rows } = await listItems(db, { q: "docking" }, { enableVariants: true });
    const dock = rows.find((r) => r.name === "Docking Hub");
    expect(dock?.variants?.[0]?.available).toBe(3); // 4 − 1
    expect(dock?.available).toBe(3); // agregat varian
  });
});
