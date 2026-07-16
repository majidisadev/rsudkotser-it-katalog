import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route `GET /api/admin/loans/export` (S4.1) — memetakan workbook ke respons
 * unduhan (headers) + validasi filter. DB & builder di-mock (auth via middleware).
 */
const buildMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/server/loan/export", () => ({
  buildLoansWorkbook: buildMock,
  exportFileName: () => "peminjaman-2026-08-05.xlsx",
}));

const { GET } = await import("@/app/api/admin/loans/export/route");

function req(url: string) {
  return new NextRequest(new URL(url, "http://localhost"));
}

beforeEach(() => {
  buildMock.mockReset();
  buildMock.mockResolvedValue({
    xlsx: { writeBuffer: async () => new Uint8Array([0x50, 0x4b, 3, 4]) },
  });
});

describe("GET /api/admin/loans/export (S4.1)", () => {
  it("200 dengan header unduhan xlsx", async () => {
    const res = await GET(req("/api/admin/loans/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="peminjaman-2026-08-05.xlsx"',
    );
  });

  it("meneruskan filter (status + itemId berulang) ke builder", async () => {
    await GET(req("/api/admin/loans/export?status=PENDING&itemId=3&itemId=7"));
    expect(buildMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: "PENDING", itemIds: [3, 7] }),
    );
  });

  it("400 VALIDATION untuk itemId tak valid", async () => {
    const res = await GET(req("/api/admin/loans/export?itemId=abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
    expect(buildMock).not.toHaveBeenCalled();
  });
});
