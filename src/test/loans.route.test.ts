import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitResult } from "@/lib/ratelimit";
import type { CreateLoanResult } from "@/server/loan/service";

/**
 * `POST /api/loans` (S2.3) — validasi, rate limit, DIRECT/BOOKING, bukti wajib
 * DIRECT, rollback bukti saat stok konflik. Handler diisolasi dari infra.
 */
const limitMock = vi.fn<(key: string) => Promise<RateLimitResult>>();
const createDirectLoanMock = vi.fn<() => Promise<CreateLoanResult>>();
const createBookingMock = vi.fn<() => Promise<CreateLoanResult>>();
const processProofImageMock = vi.fn();
const putMock = vi.fn(async (key: string) => ({ key, url: `/x/${key}` }));
const deleteMock = vi.fn(async () => {});

vi.mock("@/lib/ratelimit", () => ({
  getRateLimiter: async () => ({ limit: limitMock }),
}));
vi.mock("@/server/loan/service", () => {
  class LoanError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = "LoanError";
    }
  }
  return { LoanError, createDirectLoan: createDirectLoanMock, createBooking: createBookingMock };
});
vi.mock("@/lib/media/image", () => {
  class ImageError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ImageError";
    }
  }
  return { ImageError, processProofImage: processProofImageMock };
});
vi.mock("@/lib/storage", () => ({
  getStorage: async () => ({
    generateKey: (ext: string) => `key.${ext}`,
    put: putMock,
    delete: deleteMock,
    url: async (k: string) => `/x/${k}`,
  }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { POST } = await import("@/app/api/loans/route");
const { LoanError } = await import("@/server/loan/service");

const ok: RateLimitResult = { success: true, limit: 60, remaining: 59, reset: Date.now() + 1000 };

function req(fields: Record<string, string>, file?: File): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append("proof", file);
  return new NextRequest("http://localhost/api/loans", { method: "POST", body: fd });
}

const proofFile = () => new File([new Uint8Array([1, 2, 3])], "p.jpg", { type: "image/jpeg" });
const linesJson = JSON.stringify([{ itemId: 1, quantity: 1 }]);

beforeEach(() => {
  limitMock.mockReset().mockResolvedValue(ok);
  createDirectLoanMock.mockReset();
  createBookingMock.mockReset();
  processProofImageMock
    .mockReset()
    .mockResolvedValue({ data: Buffer.from([1]), mime: "image/webp", ext: "webp", sizeBytes: 1 });
  putMock.mockClear();
  deleteMock.mockClear();
});

describe("POST /api/loans (S2.3)", () => {
  it("BOOKING (tanggal terisi) → 201 PENDING, tanpa bukti", async () => {
    createBookingMock.mockResolvedValue({ loanId: 10, type: "BOOKING", status: "PENDING" });
    const res = await POST(
      req({
        borrowerName: "Sinta",
        borrowerUnit: "Anak",
        plannedDate: "2026-07-25",
        lines: linesJson,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ type: "BOOKING", status: "PENDING" });
    expect(createBookingMock).toHaveBeenCalledOnce();
    expect(createDirectLoanMock).not.toHaveBeenCalled();
  });

  it("DIRECT (tanggal kosong) + bukti → 201 ACTIVE, bukti tersimpan", async () => {
    createDirectLoanMock.mockResolvedValue({ loanId: 11, type: "DIRECT", status: "ACTIVE" });
    const res = await POST(
      req({ borrowerName: "Sinta", borrowerUnit: "Anak", lines: linesJson }, proofFile()),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ type: "DIRECT", status: "ACTIVE" });
    expect(putMock).toHaveBeenCalledOnce();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("DIRECT tanpa bukti → 400 VALIDATION", async () => {
    const res = await POST(req({ borrowerName: "Sinta", borrowerUnit: "Anak", lines: linesJson }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
    expect(createDirectLoanMock).not.toHaveBeenCalled();
  });

  it("body tak valid (nama kosong) → 400 VALIDATION", async () => {
    const res = await POST(req({ borrowerName: "", borrowerUnit: "Anak", lines: linesJson }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("rate limited → 429 RATE_LIMITED", async () => {
    limitMock.mockResolvedValue({ ...ok, success: false });
    const res = await POST(req({ borrowerName: "S", borrowerUnit: "A", lines: linesJson }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
  });

  it("stok konflik → 409 CONFLICT + bukti di-rollback (storage.delete)", async () => {
    createDirectLoanMock.mockRejectedValue(new LoanError("CONFLICT", "Stok tidak mencukupi."));
    const res = await POST(
      req({ borrowerName: "Sinta", borrowerUnit: "Anak", lines: linesJson }, proofFile()),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("CONFLICT");
    expect(putMock).toHaveBeenCalledOnce();
    expect(deleteMock).toHaveBeenCalledOnce(); // rollback blob orphan
  });

  it("kegagalan tak terduga → 503 SERVICE_UNAVAILABLE", async () => {
    createBookingMock.mockRejectedValue(new Error("db down"));
    const res = await POST(
      req({ borrowerName: "S", borrowerUnit: "A", plannedDate: "2026-07-25", lines: linesJson }),
    );
    expect(res.status).toBe(503);
  });
});
