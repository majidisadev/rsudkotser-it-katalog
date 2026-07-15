import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { HOLDING_STATUSES, categories, items, loanItems, loans } from "@/lib/db/schema";
import type { ItemInput } from "@/lib/validation/admin";
import { computeAvailable } from "./availability";
import type { CatalogDb } from "./service";

/**
 * Catalog service — sisi tulis admin (Sprint 03). Owner entitas items/categories
 * (SDD). CRUD barang & kategori + listing admin dengan stok+ketersediaan.
 * Foto ditangani route (StorageAdapter); service hanya mengelola kolom
 * `photoKey`/`photoUrl`. Ketersediaan tetap dihitung (tak disimpan).
 */
export class CatalogError extends Error {
  constructor(
    public readonly code: "CONFLICT" | "NOT_FOUND" | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export interface AdminItemDTO {
  id: number;
  name: string;
  categoryId: number | null;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  photoKey: string | null;
  hasVariants: boolean;
  stockTotal: number;
  available: number;
}

/** Daftar barang untuk tabel admin (S5) — termasuk stok total + ketersediaan. */
export async function listItemsAdmin(
  db: CatalogDb,
  query: { q?: string; category?: number } = {},
): Promise<AdminItemDTO[]> {
  const cats = await db.select().from(categories);
  const catName = new Map(cats.map((c) => [c.id, c.name] as const));

  const conds = [];
  if (query.q) conds.push(ilike(items.name, `%${query.q}%`));
  if (query.category) conds.push(eq(items.categoryId, query.category));
  const rows = await db
    .select()
    .from(items)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(items.name);

  const itemIds = rows.map((r) => r.id);
  const heldRows = itemIds.length
    ? await db
        .select({
          itemId: loanItems.itemId,
          held: sql<number>`coalesce(sum(${loanItems.quantity} - ${loanItems.quantityReturned}), 0)::int`,
        })
        .from(loanItems)
        .innerJoin(loans, eq(loanItems.loanId, loans.id))
        .where(and(inArray(loanItems.itemId, itemIds), inArray(loans.status, [...HOLDING_STATUSES])))
        .groupBy(loanItems.itemId)
    : [];
  const heldByItem = new Map(heldRows.map((h) => [h.itemId, h.held] as const));

  return rows.map((it) => ({
    id: it.id,
    name: it.name,
    categoryId: it.categoryId,
    category: it.categoryId !== null ? (catName.get(it.categoryId) ?? null) : null,
    description: it.description,
    photoUrl: it.photoUrl,
    photoKey: it.photoKey,
    hasVariants: it.hasVariants,
    stockTotal: it.stockTotal,
    available: computeAvailable(it.stockTotal, heldByItem.get(it.id) ?? 0),
  }));
}

export interface ItemPhoto {
  photoKey?: string | null;
  photoUrl?: string | null;
}

/** Buat barang (FR3). Foto opsional (kolom di-set route). */
export async function createItem(
  db: CatalogDb,
  input: ItemInput & ItemPhoto,
): Promise<number> {
  await assertCategoryExists(db, input.categoryId);
  const [row] = await db
    .insert(items)
    .values({
      name: input.name,
      categoryId: input.categoryId ?? null,
      description: input.description ?? null,
      stockTotal: input.stockTotal,
      photoKey: input.photoKey ?? null,
      photoUrl: input.photoUrl ?? null,
    })
    .returning({ id: items.id });
  return row.id;
}

/** Ubah barang (FR3). Kolom foto hanya di-set bila `photoKey`/`photoUrl` diberi. */
export async function updateItem(
  db: CatalogDb,
  id: number,
  input: ItemInput & { photo?: ItemPhoto },
): Promise<void> {
  const existing = await getItem(db, id);
  if (!existing) throw new CatalogError("NOT_FOUND", "Barang tidak ditemukan.");
  await assertCategoryExists(db, input.categoryId);

  const patch: Record<string, unknown> = {
    name: input.name,
    categoryId: input.categoryId ?? null,
    description: input.description ?? null,
    stockTotal: input.stockTotal,
    updatedAt: new Date(),
  };
  if (input.photo) {
    patch.photoKey = input.photo.photoKey ?? null;
    patch.photoUrl = input.photo.photoUrl ?? null;
  }
  await db.update(items).set(patch).where(eq(items.id, id));
}

/**
 * Hapus barang (FR3). Ditolak `CONFLICT` bila punya riwayat peminjaman
 * (`loan_items` — FK restrict): riwayat tak boleh hilang (PRD R3/FR14).
 * Mengembalikan `photoKey` agar route menghapus blob-nya.
 */
export async function deleteItem(db: CatalogDb, id: number): Promise<{ photoKey: string | null }> {
  const existing = await getItem(db, id);
  if (!existing) throw new CatalogError("NOT_FOUND", "Barang tidak ditemukan.");

  const [{ refs }] = await db
    .select({ refs: sql<number>`count(*)::int` })
    .from(loanItems)
    .where(eq(loanItems.itemId, id));
  if (refs > 0) {
    throw new CatalogError(
      "CONFLICT",
      "Barang punya riwayat peminjaman dan tak bisa dihapus. Nolkan stoknya bila tak dipakai lagi.",
    );
  }

  await db.delete(items).where(eq(items.id, id)); // varian ikut terhapus (cascade)
  return { photoKey: existing.photoKey };
}

export async function getItem(db: CatalogDb, id: number) {
  const [row] = await db.select().from(items).where(eq(items.id, id));
  return row ?? null;
}

async function assertCategoryExists(db: CatalogDb, categoryId?: number | null): Promise<void> {
  if (categoryId == null) return;
  const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId));
  if (!row) throw new CatalogError("VALIDATION", "Kategori tidak ditemukan.");
}

// ── Kategori (UX-012) ────────────────────────────────────────────────────────

export async function listCategories(db: CatalogDb) {
  return db.select().from(categories).orderBy(categories.name);
}

export async function createCategory(db: CatalogDb, name: string): Promise<number> {
  const [row] = await db.insert(categories).values({ name }).returning({ id: categories.id });
  return row.id;
}

export async function updateCategory(db: CatalogDb, id: number, name: string): Promise<void> {
  const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id));
  if (!row) throw new CatalogError("NOT_FOUND", "Kategori tidak ditemukan.");
  await db.update(categories).set({ name }).where(eq(categories.id, id));
}

/**
 * Hapus kategori. Barang yang memakainya otomatis kehilangan kategori
 * (`items.category_id ON DELETE SET NULL` — SDD), tak menghalangi penghapusan.
 */
export async function deleteCategory(db: CatalogDb, id: number): Promise<void> {
  const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id));
  if (!row) throw new CatalogError("NOT_FOUND", "Kategori tidak ditemukan.");
  await db.update(items).set({ categoryId: null }).where(eq(items.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));
}
