import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse, parseId } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { ImageError } from "@/lib/media/image";
import { storeImageFile } from "@/lib/media/photo";
import { getStorage } from "@/lib/storage";
import { itemInputSchema } from "@/lib/validation/admin";
import { deleteItem, getItem, updateItem } from "@/server/catalog/admin";

export const dynamic = "force-dynamic";

/** `PATCH /api/admin/items/:id` — ubah barang (FR3). Multipart: fields + foto. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return errorResponse("VALIDATION", "ID barang tidak valid.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse("VALIDATION", "Format permintaan tidak valid.");
  }

  const parsed = itemInputSchema.safeParse({
    name: form.get("name") ?? undefined,
    categoryId: (form.get("categoryId") as string) || undefined,
    description: (form.get("description") as string) || undefined,
    stockTotal: form.get("stockTotal") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("VALIDATION", parsed.error.issues[0]?.message ?? "Data barang tidak valid.");
  }

  try {
    const existing = await getItem(db, id);
    if (!existing) return errorResponse("NOT_FOUND", "Barang tidak ditemukan.");

    const file = form.get("photo");
    const removePhoto = form.get("removePhoto") === "true";
    let photo: { photoKey: string | null; photoUrl: string | null } | undefined;
    let oldKeyToDelete: string | null = null;

    if (file instanceof File && file.size > 0) {
      try {
        const stored = await storeImageFile(file);
        photo = { photoKey: stored.key, photoUrl: stored.url };
        oldKeyToDelete = existing.photoKey; // ganti foto → hapus yang lama
      } catch (err) {
        if (err instanceof ImageError) return errorResponse("VALIDATION", err.message);
        throw err;
      }
    } else if (removePhoto) {
      photo = { photoKey: null, photoUrl: null };
      oldKeyToDelete = existing.photoKey;
    }

    await updateItem(db, id, { ...parsed.data, photo });

    if (oldKeyToDelete) {
      const storage = await getStorage();
      await storage.delete(oldKeyToDelete).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "PATCH /api/admin/items/:id gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menyimpan barang.");
  }
}

/** `DELETE /api/admin/items/:id` — hapus barang + foto (FR3). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return errorResponse("VALIDATION", "ID barang tidak valid.");
  try {
    const { photoKey } = await deleteItem(db, id);
    if (photoKey) {
      const storage = await getStorage();
      await storage.delete(photoKey).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "DELETE /api/admin/items/:id gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menghapus barang.");
  }
}
