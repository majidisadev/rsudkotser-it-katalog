import { z } from "zod";

/**
 * Skema Zod dipakai ulang client + server (SDD invariant — satu sumber
 * validasi). Query katalog publik `GET /api/items`.
 */
export const itemsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.coerce.number().int().positive().optional(),
});

export type ItemsQuery = z.infer<typeof itemsQuerySchema>;

/** Bentuk respons publik (kontrak SDD API Design). */
export interface ItemVariantDTO {
  id: number;
  name: string;
  available: number;
}

export interface ItemDTO {
  id: number;
  name: string;
  category: string | null;
  categoryId: number | null;
  description: string | null;
  photoUrl: string | null;
  hasVariants: boolean;
  available: number;
  /** Stok total — batas kuantitas booking barang yang sedang habis. */
  stockTotal: number;
  variants?: ItemVariantDTO[];
}

export interface CategoryDTO {
  id: number;
  name: string;
}

export interface ItemsResponse {
  items: ItemDTO[];
  categories: CategoryDTO[];
}
