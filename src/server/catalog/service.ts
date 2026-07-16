import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { HOLDING_STATUSES, categories, items, loanItems, loans } from "@/lib/db/schema";
import type { ItemDTO, ItemsQuery, ItemsResponse } from "@/lib/validation/items";
import { computeAvailable } from "./availability";

/**
 * Catalog service — owner entitas items/categories (SDD).
 * Membaca ketersediaan (fungsi tunggal `computeAvailable`); TIDAK menulis
 * status/stok (itu Loan service, Sprint 02). DB di-inject agar dapat diuji
 * atas Postgres uji (pglite).
 *
 * Mode varian dibatalkan (PRD FR4 → Won't Have, keputusan Sprint 04): setiap
 * barang memakai `stock_total` tunggal. Kolom `item_variants`/`variant_id`
 * dibiarkan dorman di skema (nullable, tak dipakai) — aman dijatuhkan nanti.
 */
export type CatalogDb = PostgresJsDatabase<typeof schema>;

export async function listItems(db: CatalogDb, query: ItemsQuery): Promise<ItemsResponse> {
  const cats = await db.select().from(categories).orderBy(categories.name);

  const conds = [];
  if (query.q) conds.push(ilike(items.name, `%${query.q}%`));
  if (query.category) conds.push(eq(items.categoryId, query.category));
  const rows = await db
    .select()
    .from(items)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(items.name);

  const itemIds = rows.map((r) => r.id);

  // Σ(quantity − quantity_returned) untuk status yang menahan stok (RESERVED, ACTIVE).
  const heldRows = itemIds.length
    ? await db
        .select({
          itemId: loanItems.itemId,
          held: sql<number>`coalesce(sum(${loanItems.quantity} - ${loanItems.quantityReturned}), 0)::int`,
        })
        .from(loanItems)
        .innerJoin(loans, eq(loanItems.loanId, loans.id))
        .where(
          and(
            inArray(loanItems.itemId, itemIds),
            inArray(loans.status, [...HOLDING_STATUSES]),
          ),
        )
        .groupBy(loanItems.itemId)
    : [];

  const heldByItem = new Map(heldRows.map((h) => [h.itemId, h.held] as const));
  const catName = new Map(cats.map((c) => [c.id, c.name] as const));

  const dto: ItemDTO[] = rows.map((it) => ({
    id: it.id,
    name: it.name,
    categoryId: it.categoryId,
    category: it.categoryId !== null ? (catName.get(it.categoryId) ?? null) : null,
    description: it.description,
    photoUrl: it.photoUrl,
    hasVariants: it.hasVariants, // dorman — selalu false (mode varian dibatalkan)
    available: computeAvailable(it.stockTotal, heldByItem.get(it.id) ?? 0),
  }));

  return {
    items: dto,
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
  };
}
