import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { ImageError } from "@/lib/media/image";
import { storeImageFile } from "@/lib/media/photo";
import { getStorage } from "@/lib/storage";
import { activateLoan } from "@/server/loan/service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/admin/loans/:id/activate` — serah-terima booking: RESERVED → ACTIVE
 * + rekam bukti **PICKUP** (multipart `proof`, wajib — DSD UX-011/FR10). Bila
 * aktivasi gagal setelah bukti tersimpan, blob di-rollback (hindari orphan).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return errorResponse("VALIDATION", "ID peminjaman tidak valid.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse("VALIDATION", "Format permintaan tidak valid.");
  }

  const file = form.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse(
      "VALIDATION",
      "Tambahkan bukti dulu — foto atau tanda tangan — sebelum menandai Diambil.",
    );
  }

  let stored;
  try {
    stored = await storeImageFile(file);
  } catch (err) {
    if (err instanceof ImageError) return errorResponse("VALIDATION", err.message);
    logger.error({ err }, "activate: proses bukti gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memproses bukti.");
  }

  try {
    await activateLoan(db, id, { storageKey: stored.key, mime: stored.mime, sizeBytes: stored.sizeBytes });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Rollback blob bila aktivasi gagal (status salah, dll.).
    const storage = await getStorage();
    await storage.delete(stored.key).catch(() => {});
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "activate gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menandai Diambil.");
  }
}
