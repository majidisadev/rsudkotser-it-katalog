import type { SessionOptions } from "iron-session";
import { getEnv } from "@/lib/env";

/**
 * Konfigurasi sesi admin — dipisah dari `session.ts` agar dapat diimpor oleh
 * **middleware** (edge runtime) tanpa menarik `next/headers` (yang hanya sah
 * di Route Handler / Server Component). SDD ADR-007.
 */
export interface AdminSession {
  isAdmin?: boolean;
  /** Epoch ms saat login — untuk audit/sliding renewal. */
  loginAt?: number;
}

export const SESSION_COOKIE = "rsudkotser_admin";
/** Masa berlaku sesi (7 hari) — sliding: diperpanjang tiap request admin. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function sessionOptions(): SessionOptions {
  const env = getEnv();
  return {
    password: env.SESSION_SECRET,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    },
  };
}
