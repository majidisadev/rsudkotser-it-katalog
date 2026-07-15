import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { items } from "@/lib/db/schema";
import {
  CatalogError,
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  listCategories,
  listItemsAdmin,
  updateCategory,
  updateItem,
} from "@/server/catalog/admin";
import type { CatalogDb } from "@/server/catalog/service";
import { createDirectLoan, type LoanDb } from "@/server/loan/service";

/** Integration CRUD barang & kategori admin (S3.3) atas pglite. */
let db: CatalogDb & LoanDb;

beforeAll(async () => {
  const client = new PGlite();
  const drizzleDb = drizzle(client, { schema });
  await migrate(drizzleDb, { migrationsFolder: "drizzle" });
  db = drizzleDb as unknown as CatalogDb & LoanDb;
});

describe("Catalog admin CRUD (S3.3)", () => {
  it("create + list barang dengan stok & ketersediaan", async () => {
    const catId = await createCategory(db, "Presentasi");
    const id = await createItem(db, {
      name: "Proyektor A",
      categoryId: catId,
      description: "desc",
      stockTotal: 3,
    });
    const list = await listItemsAdmin(db);
    const row = list.find((r) => r.id === id)!;
    expect(row).toMatchObject({ name: "Proyektor A", stockTotal: 3, available: 3, category: "Presentasi" });
  });

  it("ketersediaan admin memperhitungkan stok tertahan", async () => {
    const id = await createItem(db, { name: "Proyektor B", stockTotal: 2, categoryId: null, description: null });
    await createDirectLoan(db, {
      borrowerName: "S",
      borrowerUnit: "U",
      lines: [{ itemId: id, quantity: 1 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    const row = (await listItemsAdmin(db)).find((r) => r.id === id)!;
    expect(row.stockTotal).toBe(2);
    expect(row.available).toBe(1);
  });

  it("update barang mengubah kolom", async () => {
    const id = await createItem(db, { name: "Lama", stockTotal: 1, categoryId: null, description: null });
    await updateItem(db, id, { name: "Baru", stockTotal: 9, categoryId: null, description: "x" });
    const [row] = await db.select().from(items).where(eq(items.id, id));
    expect(row.name).toBe("Baru");
    expect(row.stockTotal).toBe(9);
  });

  it("hapus barang tanpa riwayat → sukses; dengan riwayat → CONFLICT", async () => {
    const free = await createItem(db, { name: "Bebas", stockTotal: 1, categoryId: null, description: null });
    await expect(deleteItem(db, free)).resolves.toMatchObject({ photoKey: null });
    expect((await db.select().from(items).where(eq(items.id, free)))).toHaveLength(0);

    const used = await createItem(db, { name: "Terpakai", stockTotal: 2, categoryId: null, description: null });
    await createDirectLoan(db, {
      borrowerName: "S",
      borrowerUnit: "U",
      lines: [{ itemId: used, quantity: 1 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    await expect(deleteItem(db, used)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("update/delete barang tak ada → NOT_FOUND", async () => {
    await expect(deleteItem(db, 999999)).rejects.toBeInstanceOf(CatalogError);
    await expect(
      updateItem(db, 999999, { name: "X", stockTotal: 1, categoryId: null, description: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("kategori CRUD; hapus kategori menolkan kategori barang (SET NULL)", async () => {
    const catId = await createCategory(db, "Jaringan");
    await updateCategory(db, catId, "Jaringan & Kabel");
    expect((await listCategories(db)).some((c) => c.name === "Jaringan & Kabel")).toBe(true);

    const itemId = await createItem(db, { name: "Kabel", stockTotal: 5, categoryId: catId, description: null });
    await deleteCategory(db, catId);
    const [row] = await db.select().from(items).where(eq(items.id, itemId));
    expect(row.categoryId).toBeNull();
  });

  it("membuat barang dengan kategori tak ada → VALIDATION", async () => {
    await expect(
      createItem(db, { name: "X", stockTotal: 1, categoryId: 999999, description: null }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
