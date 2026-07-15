import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { ImageError } from "@/lib/media/image";
import { storeImageFile } from "@/lib/media/photo";
import { itemInputSchema } from "@/lib/validation/admin";
import { createItem, listItemsAdmin } from "@/server/catalog/admin";

export const dynamic = "force-dynamic";

/** `GET /api/admin/items` — daftar barang admin (stok + ketersediaan). */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const catRaw = req.nextUrl.searchParams.get("category");
    const category = catRaw ? Number(catRaw) : undefined;
    const items = await listItemsAdmin(db, {
      q,
      category: category && Number.isInteger(category) ? category : undefined,
    });
    return NextResponse.json({ items });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/items gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memuat barang.");
  }
}

/** `POST /api/admin/items` — buat barang (FR3). Multipart: fields + foto opsional. */
export async function POST(req: NextRequest) {
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
    let photo: { photoKey?: string; photoUrl?: string } = {};
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) {
      try {
        const stored = await storeImageFile(file);
        photo = { photoKey: stored.key, photoUrl: stored.url };
      } catch (err) {
        if (err instanceof ImageError) return errorResponse("VALIDATION", err.message);
        throw err;
      }
    }
    const id = await createItem(db, { ...parsed.data, ...photo });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "POST /api/admin/items gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menyimpan barang.");
  }
}
