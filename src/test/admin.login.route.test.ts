import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitResult } from "@/lib/ratelimit";

/**
 * `POST /api/admin/login` (S3.1) — rate limit, verifikasi argon2, set sesi.
 * Handler diisolasi dari argon2/iron-session/env nyata.
 */
const limitMock = vi.fn<(key: string) => Promise<RateLimitResult>>();
const verifyPasswordMock = vi.fn<() => Promise<boolean>>();
const saveMock = vi.fn(async () => {});
const session: { isAdmin?: boolean; loginAt?: number; save: typeof saveMock } = { save: saveMock };

vi.mock("@/lib/ratelimit", () => ({ getRateLimiter: async () => ({ limit: limitMock }) }));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: verifyPasswordMock }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ ADMIN_PASSWORD_HASH: "$argon2id$dummy" }) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { POST } = await import("@/app/api/admin/login/route");

const ok: RateLimitResult = { success: true, limit: 60, remaining: 59, reset: Date.now() + 1000 };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  limitMock.mockReset().mockResolvedValue(ok);
  verifyPasswordMock.mockReset();
  saveMock.mockClear();
  delete session.isAdmin;
  delete session.loginAt;
});

describe("POST /api/admin/login (S3.1)", () => {
  it("password benar → 200, sesi di-set & disimpan", async () => {
    verifyPasswordMock.mockResolvedValue(true);
    const res = await POST(req({ password: "admin123" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(session.isAdmin).toBe(true);
    expect(typeof session.loginAt).toBe("number");
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it("password salah → 401 UNAUTHORIZED, sesi tak di-set", async () => {
    verifyPasswordMock.mockResolvedValue(false);
    const res = await POST(req({ password: "salah" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(session.isAdmin).toBeUndefined();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("tanpa password → 400 VALIDATION", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("rate limited → 429 RATE_LIMITED (brute-force)", async () => {
    limitMock.mockResolvedValue({ ...ok, success: false });
    const res = await POST(req({ password: "admin123" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });
});
