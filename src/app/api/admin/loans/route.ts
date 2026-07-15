import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { loansQuerySchema } from "@/lib/validation/admin";
import { listLoans } from "@/server/loan/queries";

export const dynamic = "force-dynamic";

/** `GET /api/admin/loans` — daftar peminjaman terfilter (S6, FR13). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = loansQuerySchema.safeParse({
    status: sp.get("status") || undefined,
    type: sp.get("type") || undefined,
    q: sp.get("q") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
  });
  if (!parsed.success) {
    return errorResponse("VALIDATION", parsed.error.issues[0]?.message ?? "Filter tidak valid.");
  }
  try {
    return NextResponse.json({ loans: await listLoans(db, parsed.data) });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/loans gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memuat peminjaman.");
  }
}
