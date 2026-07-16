import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { loansQueryFromParams } from "@/lib/http/loan-actions";
import { logger } from "@/lib/logger";
import { buildLoansWorkbook, exportFileName } from "@/server/loan/export";

export const dynamic = "force-dynamic";

/**
 * `GET /api/admin/loans/export` — unduh Excel daftar peminjaman (FR13, ADR-008).
 * Menerima filter yang **sama** dengan `GET /api/admin/loans` → ekspor mengikuti
 * tampilan admin. Auth ditegakkan middleware (route tak cek sesi lagi).
 */
export async function GET(req: NextRequest) {
  const parsed = loansQueryFromParams(req.nextUrl.searchParams);
  if (!parsed.success) {
    return errorResponse("VALIDATION", parsed.error.issues[0]?.message ?? "Filter tidak valid.");
  }
  try {
    const wb = await buildLoansWorkbook(db, parsed.data);
    const buffer = await wb.xlsx.writeBuffer();
    const filename = exportFileName();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/loans/export gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal membuat ekspor. Coba lagi sebentar.");
  }
}
