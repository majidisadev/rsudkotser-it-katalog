import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { deleteNotifications, listNotifications } from "@/server/notification/service";

export const dynamic = "force-dynamic";

/** `GET /api/admin/notifications` — daftar + unread count (polling, ADR-010). */
export async function GET() {
  try {
    const { items, unread } = await listNotifications(db);
    return NextResponse.json({ notifications: items, unread });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/notifications gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memuat notifikasi.");
  }
}

/** `DELETE /api/admin/notifications` — hapus (`{ ids? }` / semua). */
export async function DELETE(req: NextRequest) {
  let ids: number[] | undefined;
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body?.ids)) ids = body.ids.filter((n): n is number => Number.isInteger(n));
  } catch {
    // Body kosong → hapus semua.
  }
  try {
    await deleteNotifications(db, ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/admin/notifications gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menghapus notifikasi.");
  }
}
