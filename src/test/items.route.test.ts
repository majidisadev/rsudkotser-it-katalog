import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitResult } from "@/lib/ratelimit";
import type { ItemsResponse } from "@/lib/validation/items";

// Isolasi handler dari infra (DB/limiter) — uji logika validasi + rate limit.
const limitMock = vi.fn<(key: string) => Promise<RateLimitResult>>();
const listItemsMock = vi.fn<() => Promise<ItemsResponse>>();

vi.mock("@/lib/ratelimit", () => ({
  getRateLimiter: async () => ({ limit: limitMock }),
}));
vi.mock("@/server/catalog/service", () => ({ listItems: listItemsMock }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { GET } = await import("@/app/api/items/route");

function req(url: string) {
  return new NextRequest(new URL(url, "http://localhost"));
}

const ok: RateLimitResult = { success: true, limit: 60, remaining: 59, reset: Date.now() + 1000 };

beforeEach(() => {
  limitMock.mockReset();
  listItemsMock.mockReset();
});

describe("GET /api/items (S1.5)", () => {
  it("AC1 — 200 dengan bentuk respons SDD", async () => {
    limitMock.mockResolvedValue(ok);
    listItemsMock.mockResolvedValue({
      items: [
        {
          id: 1,
          name: "Proyektor",
          category: "Presentasi",
          categoryId: 1,
          description: null,
          photoUrl: null,
          hasVariants: false,
          available: 2,
        },
      ],
      categories: [{ id: 1, name: "Presentasi" }],
    });
    const res = await GET(req("/api/items?q=proyektor"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ItemsResponse;
    expect(body.items[0].available).toBe(2);
    expect(body.categories).toHaveLength(1);
  });

  it("AC2 — 429 saat melewati rate limit, amplop RATE_LIMITED", async () => {
    limitMock.mockResolvedValue({ ...ok, success: false });
    const res = await GET(req("/api/items"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("AC3 — 400 VALIDATION untuk query tak valid", async () => {
    limitMock.mockResolvedValue(ok);
    const res = await GET(req("/api/items?category=abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("503 SERVICE_UNAVAILABLE saat service melempar", async () => {
    limitMock.mockResolvedValue(ok);
    listItemsMock.mockRejectedValue(new Error("db down"));
    const res = await GET(req("/api/items"));
    expect(res.status).toBe(503);
  });
});
