import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";
import { deleteProof } from "@/server/loan/service";

export const dynamic = "force-dynamic";

/**
 * `DELETE /api/admin/proofs/:id` — hapus bukti: metadata DB dulu (sumber
 * kebenaran), lalu blob (SDD External Integrations — orphan ditolerir).
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return errorResponse("VALIDATION", "ID bukti tidak valid.");
  try {
    const { storageKey } = await deleteProof(db, id);
    const storage = await getStorage();
    await storage.delete(storageKey).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "DELETE proof gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menghapus bukti.");
  }
}
