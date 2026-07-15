import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { quantitySchema } from "@/lib/validation/admin";
import { patchLineQuantity } from "@/server/loan/service";

export const dynamic = "force-dynamic";

/**
 * `PATCH /api/admin/loans/:id/lines/:lineId` — koreksi jumlah baris **hanya saat
 * PENDING** (DSD F3). Ditolak 409 bila status ≠ PENDING (ditegakkan service).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id: idRaw, lineId: lineRaw } = await ctx.params;
  const id = parseId(idRaw);
  const lineId = parseId(lineRaw);
  if (id === null || lineId === null) return errorResponse("VALIDATION", "ID tidak valid.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION", "Format permintaan tidak valid.");
  }
  const parsed = quantitySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("VALIDATION", parsed.error.issues[0]?.message ?? "Jumlah tidak valid.");
  }

  try {
    await patchLineQuantity(db, id, lineId, parsed.data.quantity);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "PATCH line gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal mengubah jumlah.");
  }
}
