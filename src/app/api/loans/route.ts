import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { getRateLimiter } from "@/lib/ratelimit";
import { getStorage } from "@/lib/storage";
import { ImageError, processProofImage } from "@/lib/media/image";
import { checkoutSchema, isBooking, type CreateLoanResponse } from "@/lib/validation/loans";
import {
  LoanError,
  createBooking,
  createDirectLoan,
} from "@/server/loan/service";

export const dynamic = "force-dynamic";

/** Kunci rate-limit per-IP (SDD Security — endpoint publik tulis ber-rate-limit). */
function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon").slice(0, 64);
}

/**
 * `POST /api/loans` — checkout publik (SDD *API Design*, Flow 1/2). Multipart.
 * Tanggal rencana KOSONG → DIRECT (bukti CHECKOUT **wajib**, stok tertahan);
 * TERISI → BOOKING (tanpa bukti, status PENDING). Skema Zod sama dengan form
 * client. Stok tak cukup → 409 CONFLICT (SDD Error Handling).
 */
export async function POST(req: NextRequest) {
  // 1. Rate limit (fail-open di adapter).
  const limiter = await getRateLimiter();
  const rl = await limiter.limit(`loans:${clientKey(req)}`);
  if (!rl.success) {
    return errorResponse("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi sebentar, ya.", {
      "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
    });
  }

  // 2. Parse multipart + validasi Zod bersama.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse("VALIDATION", "Format permintaan tidak valid.");
  }

  const rawLines = form.get("lines");
  let lines: unknown;
  try {
    lines = typeof rawLines === "string" ? JSON.parse(rawLines) : undefined;
  } catch {
    return errorResponse("VALIDATION", "Daftar barang tidak valid.");
  }

  const parsed = checkoutSchema.safeParse({
    borrowerName: form.get("borrowerName") ?? undefined,
    borrowerUnit: form.get("borrowerUnit") ?? undefined,
    plannedDate: form.get("plannedDate") || undefined,
    note: form.get("note") || undefined,
    lines,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse("VALIDATION", first?.message ?? "Data checkout tidak valid.");
  }
  const input = parsed.data;

  try {
    // 3a. BOOKING — tanpa bukti, stok belum ditahan.
    if (isBooking(input.plannedDate)) {
      const result = await createBooking(db, {
        borrowerName: input.borrowerName,
        borrowerUnit: input.borrowerUnit,
        plannedDate: input.plannedDate as string,
        note: input.note,
        lines: input.lines,
      });
      return NextResponse.json(result satisfies CreateLoanResponse, { status: 201 });
    }

    // 3b. DIRECT — bukti CHECKOUT wajib (SDD/DSD UX-011).
    const file = form.get("proof");
    if (!(file instanceof File) || file.size === 0) {
      return errorResponse(
        "VALIDATION",
        "Tambahkan bukti dulu — foto atau tanda tangan — sebelum melanjutkan.",
      );
    }

    let processed;
    try {
      processed = await processProofImage(Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      if (err instanceof ImageError) return errorResponse("VALIDATION", err.message);
      throw err;
    }

    // Simpan bukti dulu; bila pembuatan loan gagal (mis. stok habis), rollback
    // dengan menghapus blob (SDD External Integrations — hindari orphan).
    const storage = await getStorage();
    const key = storage.generateKey(processed.ext);
    const { key: storedKey } = await storage.put(key, processed.data, processed.mime);

    try {
      const result = await createDirectLoan(db, {
        borrowerName: input.borrowerName,
        borrowerUnit: input.borrowerUnit,
        note: input.note,
        lines: input.lines,
        proof: { storageKey: storedKey, mime: processed.mime, sizeBytes: processed.sizeBytes },
      });
      return NextResponse.json(result satisfies CreateLoanResponse, { status: 201 });
    } catch (err) {
      await storage.delete(storedKey).catch(() => {});
      throw err;
    }
  } catch (err) {
    if (err instanceof LoanError) {
      const code = err.code === "CONFLICT" ? "CONFLICT" : err.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION";
      return errorResponse(code, err.message);
    }
    logger.error({ err }, "POST /api/loans gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memproses peminjaman. Coba lagi sebentar.");
  }
}
