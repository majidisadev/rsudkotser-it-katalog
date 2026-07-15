import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { RateLimiter, RateLimitResult } from "./index";

/**
 * Impl Upstash (target Vercel & self-host via HTTP). SDK dikurung di file ini
 * (boundary infra). Error jaringan ditangani oleh `withFailOpen` di factory.
 */
export class UpstashRateLimiter implements RateLimiter {
  private readonly rl: Ratelimit;

  constructor(url: string, token: string, max: number, windowSec: number) {
    this.rl = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: "rl:items",
    });
  }

  async limit(key: string): Promise<RateLimitResult> {
    const r = await this.rl.limit(key);
    return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
  }
}
