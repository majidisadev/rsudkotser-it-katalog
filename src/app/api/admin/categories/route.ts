import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainErrorResponse } from "@/lib/http/admin";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { categoryInputSchema } from "@/lib/validation/admin";
import { createCategory, listCategories } from "@/server/catalog/admin";

export const dynamic = "force-dynamic";

/** `GET /api/admin/categories` — daftar kategori (UX-012). */
export async function GET() {
  try {
    return NextResponse.json({ categories: await listCategories(db) });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/categories gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memuat kategori.");
  }
}

/** `POST /api/admin/categories` — buat kategori. */
export async function POST(req: NextRequest) {
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
    const id = await createCategory(db, parsed.data.name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const mapped = domainErrorResponse(err);
    if (mapped) return mapped;
    logger.error({ err }, "POST /api/admin/categories gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menyimpan kategori.");
  }
}
