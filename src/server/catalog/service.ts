import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { HOLDING_STATUSES, categories, itemVariants, items, loanItems, loans } from "@/lib/db/schema";
import type { ItemDTO, ItemsQuery, ItemsResponse } from "@/lib/validation/items";
import { computeAvailable } from "./availability";

/**
 * Catalog service — owner entitas items/item_variants/categories (SDD).
 * Membaca ketersediaan (fungsi tunggal `computeAvailable`); TIDAK menulis
 * status/stok (itu Loan service, Sprint 02). DB di-inject agar dapat diuji
 * atas Postgres uji (pglite).
 */
export type CatalogDb = PostgresJsDatabase<typeof schema>;

export interface ListItemsOptions {
  enableVariants: boolean;
}

export async function listItems(
  db: CatalogDb,
  query: ItemsQuery,
  opts: ListItemsOptions,
): Promise<ItemsResponse> {
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
          variantId: loanItems.variantId,
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
        .groupBy(loanItems.itemId, loanItems.variantId)
    : [];

  const variantRows =
    opts.enableVariants && itemIds.length
      ? await db.select().from(itemVariants).where(inArray(itemVariants.itemId, itemIds))
      : [];

  const heldByItem = new Map<number, number>(); // baris tanpa varian (variantId null)
  const heldByVariant = new Map<number, number>();
  for (const h of heldRows) {
    if (h.variantId === null) {
      heldByItem.set(h.itemId, (heldByItem.get(h.itemId) ?? 0) + h.held);
    } else {
      heldByVariant.set(h.variantId, (heldByVariant.get(h.variantId) ?? 0) + h.held);
    }
  }

  const variantsByItem = new Map<number, typeof variantRows>();
  for (const v of variantRows) {
    const list = variantsByItem.get(v.itemId) ?? [];
    list.push(v);
    variantsByItem.set(v.itemId, list);
  }

  const catName = new Map(cats.map((c) => [c.id, c.name] as const));

  const dto: ItemDTO[] = rows.map((it) => {
    const base = {
      id: it.id,
      name: it.name,
      categoryId: it.categoryId,
      category: it.categoryId !== null ? (catName.get(it.categoryId) ?? null) : null,
      description: it.description,
      photoUrl: it.photoUrl,
    };

    if (opts.enableVariants && it.hasVariants) {
      const vs = (variantsByItem.get(it.id) ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        available: computeAvailable(v.stockTotal, heldByVariant.get(v.id) ?? 0),
      }));
      const available = vs.reduce((sum, v) => sum + v.available, 0);
      return { ...base, hasVariants: true, available, variants: vs };
    }

    return {
      ...base,
      hasVariants: it.hasVariants,
      available: computeAvailable(it.stockTotal, heldByItem.get(it.id) ?? 0),
    };
  });

  return {
    items: dto,
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
  };
}
