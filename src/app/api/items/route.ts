import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { getRateLimiter } from "@/lib/ratelimit";
import { itemsQuerySchema } from "@/lib/validation/items";
import { listItems } from "@/server/catalog/service";

export const dynamic = "force-dynamic";

/** Kunci rate-limit per-IP (SDD Security — endpoint publik ber-rate-limit). */
function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon").slice(0, 64);
}

export async function GET(req: NextRequest) {
  // Rate limit (fail-open di dalam adapter — baca tak boleh mati).
  const limiter = await getRateLimiter();
  const rl = await limiter.limit(`items:${clientKey(req)}`);
  if (!rl.success) {
    return errorResponse("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi sebentar, ya.", {
      "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
    });
  }

  // Validasi query dengan skema Zod bersama (client + server).
  const { searchParams } = new URL(req.url);
  const parsed = itemsQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("VALIDATION", "Parameter pencarian tidak valid.");
  }

  try {
    const data = await listItems(db, parsed.data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error({ err }, "GET /api/items gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memuat katalog. Coba lagi sebentar.");
  }
}
