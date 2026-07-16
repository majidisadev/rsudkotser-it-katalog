import { z } from "zod";
import { loanStatusEnum, loanTypeEnum } from "@/lib/db/schema";

/**
 * Skema Zod admin — dipakai ulang client (form/tabel) + server (route),
 * satu sumber validasi (SDD invariant). CRUD barang/kategori + aksi peminjaman.
 */

/** Input barang (fields; foto ditangani terpisah sebagai multipart di route). */
export const itemInputSchema = z.object({
  name: z.string().trim().min(1, "Nama barang wajib diisi").max(160),
  categoryId: z.coerce.number().int().positive().nullish(),
  description: z.string().trim().max(1000).nullish(),
  stockTotal: z.coerce.number().int().min(0, "Stok tak boleh negatif").max(100000),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

/** Input kategori (UX-012 — kategori dikelola bebas oleh admin). */
export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(80),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

/** Jumlah untuk aksi pengembalian / undo / koreksi baris. */
export const quantitySchema = z.object({
  quantity: z.coerce.number().int().positive("Jumlah minimal 1").max(100000),
});

/** Filter tabel peminjaman admin (SDD `GET /api/admin/loans` + `/export`). */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");
export const loansQuerySchema = z.object({
  status: z.enum(loanStatusEnum.enumValues).optional(),
  type: z.enum(loanTypeEnum.enumValues).optional(),
  q: z.string().trim().max(120).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  // Filter berdasarkan barang (Sprint 04) — peminjaman yang memuat salah satu
  // barang terpilih. Dikirim sebagai parameter `itemId` berulang di query string.
  itemIds: z.array(z.coerce.number().int().positive()).max(200).optional(),
});
export type LoansQuery = z.infer<typeof loansQuerySchema>;

export const loginSchema = z.object({
  password: z.string().min(1, "Kata sandi wajib diisi"),
});
