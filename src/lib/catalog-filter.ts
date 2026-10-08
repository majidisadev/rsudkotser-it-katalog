import type { ItemDTO } from "@/lib/validation/items";

/**
 * Penyaringan katalog di client (S1) — seluruh katalog dimuat sekali, lalu
 * disaring di memori agar ganti kategori/kata kunci instan tanpa request ulang.
 * Nama dicocokkan case-insensitive (setara `ilike '%q%'` di server).
 */
export function filterItems(items: ItemDTO[], q: string, category: number | null): ItemDTO[] {
  const needle = q.trim().toLocaleLowerCase("id");
  if (!needle && category === null) return items;
  return items.filter(
    (it) =>
      (category === null || it.categoryId === category) &&
      (!needle || it.name.toLocaleLowerCase("id").includes(needle)),
  );
}
