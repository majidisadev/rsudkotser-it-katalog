import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Middleware guard admin (S3.1) — lindungi /admin/* & /api/admin/* kecuali
 * login. iron-session & env di-mock (edge, tanpa infra nyata).
 */
const getIronSessionMock = vi.fn();
vi.mock("iron-session", () => ({ getIronSession: getIronSessionMock }));
vi.mock("@/lib/auth/session-config", () => ({ sessionOptions: () => ({}) }));

const { middleware } = await import("@/middleware");

const req = (path: string) => new NextRequest(new URL(`http://localhost${path}`));

beforeEach(() => getIronSessionMock.mockReset());

describe("middleware admin guard (S3.1)", () => {
  it("melewati POST /api/admin/login tanpa cek sesi", async () => {
    const res = await middleware(req("/api/admin/login"));
    expect(res.status).toBe(200);
    expect(getIronSessionMock).not.toHaveBeenCalled();
  });

  it("belum login + rute API admin → 401 UNAUTHORIZED", async () => {
    getIronSessionMock.mockResolvedValue({ isAdmin: false, save: vi.fn() });
    const res = await middleware(req("/api/admin/loans"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("belum login + rute halaman admin → redirect ke /admin/login?next=…", async () => {
    getIronSessionMock.mockResolvedValue({ isAdmin: false, save: vi.fn() });
    const res = await middleware(req("/admin/barang"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
    expect(res.headers.get("location")).toContain("next=%2Fadmin%2Fbarang");
  });

  it("sudah login → lanjut + perpanjang sesi (save)", async () => {
    const save = vi.fn(async () => {});
    getIronSessionMock.mockResolvedValue({ isAdmin: true, save });
    const res = await middleware(req("/admin"));
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledOnce();
  });

  it("sudah login membuka /admin/login → redirect ke /admin", async () => {
    getIronSessionMock.mockResolvedValue({ isAdmin: true, save: vi.fn() });
    const res = await middleware(req("/admin/login"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/admin$/);
  });
});
