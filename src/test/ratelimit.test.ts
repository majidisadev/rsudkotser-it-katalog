import { describe, expect, it } from "vitest";
import type { Env } from "@/lib/env";
import { selectRateLimiter, withFailOpen, type RateLimiter } from "@/lib/ratelimit";

function envWith(overrides: Partial<Env>): Env {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://x",
    STORAGE_DRIVER: "local",
    LOCAL_STORAGE_PATH: "./.storage",
    RATE_LIMIT_MAX: 3,
    RATE_LIMIT_WINDOW_SEC: 60,
    ADMIN_PASSWORD_HASH: "h",
    SESSION_SECRET: "0123456789abcdef",
    APP_URL: "http://localhost:3000",
    ...overrides,
  } as Env;
}

describe("RateLimiter factory (S1.3 AC3)", () => {
  it("memilih limiter in-memory saat env Upstash absen", async () => {
    const limiter = await selectRateLimiter(envWith({}));
    const first = await limiter.limit("ip-a");
    expect(first.success).toBe(true);
    expect(first.limit).toBe(3);
  });

  it("in-memory memblokir setelah melewati batas jendela", async () => {
    const limiter = await selectRateLimiter(envWith({}));
    const key = "ip-burst";
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.limit(key));
    expect(results.slice(0, 3).every((r) => r.success)).toBe(true);
    expect(results[3].success).toBe(false);
  });
});

describe("withFailOpen (S1.3 AC2 / DoD-sprint #7)", () => {
  it("mengizinkan request saat backend limiter melempar", async () => {
    const broken: RateLimiter = {
      limit: async () => {
        throw new Error("redis down");
      },
    };
    const safe = withFailOpen(broken, 60);
    const r = await safe.limit("ip");
    expect(r.success).toBe(true);
    expect(r.remaining).toBe(60);
  });
});
