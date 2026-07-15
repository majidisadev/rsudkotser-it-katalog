import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { quantitySchema } from "@/lib/validation/admin";
import { undoReturn } from "@/server/loan/service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/admin/loans/:id/lines/:lineId/return/undo` — urungkan pengembalian
 * (DSD F4). Menahan lagi stok → 409 CONFLICT bila stok yang bebas sudah diambil.
 */
export async function POST(
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
    await undoReturn(db, id, lineId, parsed.data.quantity);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "undo return gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal mengurungkan pengembalian.");
  }
}
