import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";
import { getLoanDetail } from "@/server/loan/queries";

export const dynamic = "force-dynamic";

/** `GET /api/admin/loans/:id` — detail peminjaman + bukti (modal S6). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return errorResponse("VALIDATION", "ID peminjaman tidak valid.");
  try {
    const detail = await getLoanDetail(db, id);
    if (!detail) return errorResponse("NOT_FOUND", "Peminjaman tidak ditemukan.");

    // Resolusi URL bukti via adapter (local-fs → /api/media, blob → URL langsung).
    const storage = await getStorage();
    const proofs = await Promise.all(
      detail.proofs.map(async (p) => ({
        id: p.id,
        kind: p.kind,
        mime: p.mime,
        createdAt: p.createdAt,
        url: await storage.url(p.storageKey),
      })),
    );
    return NextResponse.json({ loan: { ...detail, proofs } });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/loans/:id gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memuat detail peminjaman.");
  }
}
