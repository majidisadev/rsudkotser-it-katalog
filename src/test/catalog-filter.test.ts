import { describe, expect, it } from "vitest";
import { filterItems } from "@/lib/catalog-filter";
import type { ItemDTO } from "@/lib/validation/items";

/** Filter katalog di client — tanpa request ulang saat ganti kategori/kata kunci. */
const item = (id: number, name: string, categoryId: number | null): ItemDTO => ({
  id,
  name,
  categoryId,
  category: null,
  description: null,
  photoUrl: null,
  hasVariants: false,
  available: 1,
  stockTotal: 1,
});

const items = [item(1, "Laptop ASUS", 1), item(2, "Proyektor BENQ", 2), item(3, "Laptop Lenovo", 1)];

describe("filterItems", () => {
  it("tanpa filter → daftar yang sama (tanpa salinan)", () => {
    expect(filterItems(items, "  ", null)).toBe(items);
  });

  it("filter kategori", () => {
    expect(filterItems(items, "", 2).map((i) => i.id)).toEqual([2]);
  });

  it("kata kunci case-insensitive, digabung dengan kategori", () => {
    expect(filterItems(items, "LAPTOP", null).map((i) => i.id)).toEqual([1, 3]);
    expect(filterItems(items, "lenovo", 1).map((i) => i.id)).toEqual([3]);
    expect(filterItems(items, "lenovo", 2)).toEqual([]);
  });
});
