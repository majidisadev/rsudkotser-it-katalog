import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { markRead } from "@/server/notification/service";

export const dynamic = "force-dynamic";

/** `POST /api/admin/notifications/read` — tandai baca (`{ ids? }` / semua). */
export async function POST(req: NextRequest) {
  let ids: number[] | undefined;
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body?.ids)) {
      ids = body.ids.filter((n): n is number => Number.isInteger(n));
    }
  } catch {
    // Body kosong → tandai semua.
  }
  try {
    await markRead(db, ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /api/admin/notifications/read gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal menandai notifikasi.");
  }
}
