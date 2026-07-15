import { z } from "zod";

/**
 * Skema Zod checkout peminjaman — dipakai ulang client (form) + server (route),
 * satu sumber validasi (SDD invariant). Bukti (file) divalidasi terpisah
 * (multipart) di `src/lib/media` + aturan wajib-bila-DIRECT di route.
 */

/** Satu baris keranjang: barang (+ varian opsional) & kuantitas. */
export const loanLineSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().nullish(),
  quantity: z.coerce.number().int().positive().max(999),
});

export type LoanLineInput = z.infer<typeof loanLineSchema>;

/** Tanggal rencana pakai (ISO `YYYY-MM-DD`). Terisi → BOOKING; kosong → DIRECT. */
const plannedDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")
  .nullish();

export const checkoutSchema = z.object({
  borrowerName: z.string().trim().min(1, "Nama wajib diisi").max(120),
  borrowerUnit: z.string().trim().min(1, "Unit/ruangan wajib diisi").max(120),
  plannedDate: plannedDateSchema,
  note: z.string().trim().max(500).nullish(),
  lines: z.array(loanLineSchema).min(1, "Pilih minimal satu barang"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Pembeda DIRECT vs BOOKING — SATU form, dibedakan pengisian tanggal (UX-002).
 * Terisi (tanggal rencana pakai) → BOOKING; kosong → DIRECT.
 */
export function isBooking(plannedDate?: string | null): boolean {
  return typeof plannedDate === "string" && plannedDate.trim() !== "";
}

/** Batas & tipe bukti gambar (client + server sepakat). */
export const PROOF_ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
/** Batas ukuran unggah bukti SEBELUM kompresi server (client mengompres dulu). */
export const MAX_PROOF_BYTES = 8 * 1024 * 1024;

/** Bentuk respons sukses `POST /api/loans` (kontrak SDD API Design). */
export interface CreateLoanResponse {
  loanId: number;
  type: "DIRECT" | "BOOKING";
  status: "ACTIVE" | "PENDING";
}
