import type { RateLimiter, RateLimitResult } from "./index";

/**
 * Limiter in-memory sliding-window per-instance (default tanpa Upstash).
 * Cukup untuk skala PRD (belasan transaksi/bulan) & satu instance self-host;
 * di serverless multi-instance gunakan Upstash agar konsisten (ADR-006).
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowSec: number,
  ) {}

  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.windowSec * 1000;
    const cutoff = now - windowMs;

    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    timestamps.push(now);
    this.hits.set(key, timestamps);

    const remaining = Math.max(0, this.max - timestamps.length);
    const oldest = timestamps[0] ?? now;
    return {
      success: timestamps.length <= this.max,
      limit: this.max,
      remaining,
      reset: oldest + windowMs,
    };
  }
}
