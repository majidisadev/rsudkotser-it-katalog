import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { dashboardSummary } from "@/server/loan/queries";

export const dynamic = "force-dynamic";

/** `GET /api/admin/dashboard` — ringkasan (FR15, S4): tersedia/sedang/akan/menunggu. */
export async function GET() {
  try {
    return NextResponse.json(await dashboardSummary(db));
  } catch (err) {
    logger.error({ err }, "GET /api/admin/dashboard gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memuat ringkasan.");
  }
}
