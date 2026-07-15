import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { getRateLimiter } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Kunci rate-limit per-IP (brute-force login — SDD Security / NFR5). */
function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon").slice(0, 64);
}

/**
 * `POST /api/admin/login` — autentikasi password tunggal (FR1/NFR5, ADR-007).
 * Password diverifikasi argon2id atas `ADMIN_PASSWORD_HASH` env; sukses →
 * set sesi iron-session (`isAdmin`). Ber-rate-limit per-IP (brute-force).
 */
export async function POST(req: NextRequest) {
  const limiter = await getRateLimiter();
  const rl = await limiter.limit(`login:${clientKey(req)}`);
  if (!rl.success) {
    return errorResponse("RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi sebentar, ya.", {
      "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION", "Format permintaan tidak valid.");
  }
  const password = (body as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length === 0) {
    return errorResponse("VALIDATION", "Kata sandi wajib diisi.");
  }

  try {
    const ok = await verifyPassword(getEnv().ADMIN_PASSWORD_HASH, password);
    if (!ok) {
      return errorResponse("UNAUTHORIZED", "Kata sandi salah.");
    }

    const session = await getSession();
    session.isAdmin = true;
    session.loginAt = Date.now();
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /api/admin/login gagal");
    return errorResponse("SERVICE_UNAVAILABLE", "Gagal memproses login. Coba lagi sebentar.");
  }
}
