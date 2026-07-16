import { NextResponse } from "next/server";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { loansQuerySchema } from "@/lib/validation/admin";

/**
 * Parse filter tabel peminjaman dari query string (dipakai `GET /loans` dan
 * `GET /loans/export` — satu sumber). `itemId` dikirim sebagai parameter
 * berulang (`?itemId=1&itemId=2`); sisanya tunggal.
 */
export function loansQueryFromParams(sp: URLSearchParams) {
  const itemIds = sp.getAll("itemId").filter((v) => v.trim() !== "");
  return loansQuerySchema.safeParse({
    status: sp.get("status") || undefined,
    type: sp.get("type") || undefined,
    q: sp.get("q") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
    itemIds: itemIds.length ? itemIds : undefined,
  });
}

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
