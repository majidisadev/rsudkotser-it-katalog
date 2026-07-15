import { NextResponse } from "next/server";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";

/**
 * Pembungkus aksi transisi peminjaman (approve/reject/cancel) — parse id,
 * jalankan fungsi Loan service, petakan error domain ke amplop HTTP. Menjaga
 * route transisi tetap satu baris (SDD API Design).
 */
export async function runTransition(
  idRaw: string | undefined,
  fn: (id: number) => Promise<void>,
  logLabel: string,
): Promise<NextResponse> {
  const id = parseId(idRaw);
  if (id === null) return errorResponse("VALIDATION", "ID peminjaman tidak valid.");
  try {
    await fn(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, logLabel);
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memproses aksi. Coba lagi sebentar.");
  }
}
