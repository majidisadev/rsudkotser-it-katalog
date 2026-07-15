import type { Env } from "@/lib/env";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * RateLimiter (SDD ADR-006) — batasi laju endpoint publik & login.
 * Di balik interface agar Upstash dapat ditukar Valkey self-host tanpa
 * menyentuh domain. **Fail-open**: bila backend limiter error, request tetap
 * dilayani (limiter tak boleh mematikan alur inti).
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms saat jendela reset. */
  reset: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

/** Bungkus limiter apa pun agar gagal-terbuka saat error backend. */
export function withFailOpen(inner: RateLimiter, limit: number): RateLimiter {
  return {
    async limit(key: string): Promise<RateLimitResult> {
      try {
        return await inner.limit(key);
      } catch (err) {
        logger.warn({ err }, "RateLimiter error — fail-open (request diizinkan)");
        return { success: true, limit, remaining: limit, reset: Date.now() };
      }
    },
  };
}

/** Pilih implementasi murni dari env: Upstash bila kredensial ada, else memory. */
export async function selectRateLimiter(env: Env = getEnv()): Promise<RateLimiter> {
  const max = env.RATE_LIMIT_MAX;
  const windowSec = env.RATE_LIMIT_WINDOW_SEC;

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const { UpstashRateLimiter } = await import("./upstash");
    const limiter = new UpstashRateLimiter(
      env.UPSTASH_REDIS_REST_URL,
      env.UPSTASH_REDIS_REST_TOKEN,
      max,
      windowSec,
    );
    return withFailOpen(limiter, max);
  }

  const { MemoryRateLimiter } = await import("./memory");
  return new MemoryRateLimiter(max, windowSec);
}

let cached: RateLimiter | null = null;
export async function getRateLimiter(): Promise<RateLimiter> {
  if (cached === null) cached = await selectRateLimiter();
  return cached;
}
