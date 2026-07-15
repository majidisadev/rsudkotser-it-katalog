import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { categoryInputSchema } from "@/lib/validation/admin";
import { deleteCategory, updateCategory } from "@/server/catalog/admin";

export const dynamic = "force-dynamic";

/** `PATCH /api/admin/categories/:id` — ubah nama kategori. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return errorResponse("VALIDATION", "ID kategori tidak valid.");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION", "Format permintaan tidak valid.");
  }
  const parsed = categoryInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("VALIDATION", parsed.error.issues[0]?.message ?? "Nama kategori tidak valid.");
  }
  try {
    await updateCategory(db, id, parsed.data.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "PATCH /api/admin/categories/:id gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menyimpan kategori.");
  }
}

/** `DELETE /api/admin/categories/:id` — hapus kategori (barang → tanpa kategori). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return errorResponse("VALIDATION", "ID kategori tidak valid.");
  try {
    await deleteCategory(db, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "DELETE /api/admin/categories/:id gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menghapus kategori.");
  }
}
