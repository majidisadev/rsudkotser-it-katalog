import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route admin (S3.5) — pemetaan error domain → amplop HTTP, multipart activate,
 * dan wiring ke service. Handler diisolasi dari DB/storage/service nyata.
 * Auth ditegakkan middleware (diuji terpisah) → route tak cek sesi lagi.
 */
const approveMock = vi.fn();
const activateMock = vi.fn();
const returnLineMock = vi.fn();
const createItemMock = vi.fn();
const deleteItemMock = vi.fn();
const listItemsAdminMock = vi.fn();
const listLoansMock = vi.fn();
const markReadMock = vi.fn();
const storeImageFileMock = vi.fn();
const storageDeleteMock = vi.fn(async () => {});

class LoanError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "LoanError";
  }
}
class CatalogError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "CatalogError";
  }
}
class ImageError extends Error {}

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/storage", () => ({ getStorage: async () => ({ delete: storageDeleteMock }) }));
vi.mock("@/lib/media/photo", () => ({ storeImageFile: storeImageFileMock }));
vi.mock("@/lib/media/image", () => ({ ImageError }));
vi.mock("@/server/loan/service", () => ({
  LoanError,
  approveBooking: approveMock,
  activateLoan: activateMock,
  returnLine: returnLineMock,
}));
vi.mock("@/server/catalog/admin", () => ({
  CatalogError,
  createItem: createItemMock,
  deleteItem: deleteItemMock,
  listItemsAdmin: listItemsAdminMock,
}));
vi.mock("@/server/loan/queries", () => ({ listLoans: listLoansMock }));
vi.mock("@/server/notification/service", () => ({ markRead: markReadMock }));

const { POST: approve } = await import("@/app/api/admin/loans/[id]/approve/route");
const { POST: activate } = await import("@/app/api/admin/loans/[id]/activate/route");
const { POST: returnPost } = await import(
  "@/app/api/admin/loans/[id]/lines/[lineId]/return/route"
);
const items = await import("@/app/api/admin/items/route");
const itemsId = await import("@/app/api/admin/items/[id]/route");
const loans = await import("@/app/api/admin/loans/route");
const notifRead = await import("@/app/api/admin/notifications/read/route");

const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });
const jsonReq = (url: string, body: unknown) =>
  new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin loan transition routes (S3.5)", () => {
  it("approve sukses → 200 ok", async () => {
    approveMock.mockResolvedValue(undefined);
    const res = await approve(new Request("http://localhost"), ctx({ id: "5" }));
    expect(res.status).toBe(200);
    expect(approveMock).toHaveBeenCalledWith({}, 5);
  });

  it("approve stok kurang → 409 CONFLICT (map LoanError)", async () => {
    approveMock.mockRejectedValue(new LoanError("CONFLICT", "Stok tidak cukup."));
    const res = await approve(new Request("http://localhost"), ctx({ id: "5" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("CONFLICT");
  });

  it("approve id tak valid → 400 VALIDATION", async () => {
    const res = await approve(new Request("http://localhost"), ctx({ id: "abc" }));
    expect(res.status).toBe(400);
    expect(approveMock).not.toHaveBeenCalled();
  });
});

describe("admin activate route (S3.5)", () => {
  function multipart(file?: File) {
    const fd = new FormData();
    if (file) fd.append("proof", file);
    return new NextRequest("http://localhost/api/admin/loans/5/activate", { method: "POST", body: fd });
  }
  const proof = () => new File([new Uint8Array([1, 2, 3])], "p.jpg", { type: "image/jpeg" });

  it("tanpa bukti → 400 VALIDATION", async () => {
    const res = await activate(multipart(), ctx({ id: "5" }));
    expect(res.status).toBe(400);
    expect(storeImageFileMock).not.toHaveBeenCalled();
  });

  it("dengan bukti → 200, bukti disimpan & activateLoan dipanggil", async () => {
    storeImageFileMock.mockResolvedValue({ key: "k.webp", url: "/x", mime: "image/webp", sizeBytes: 1 });
    activateMock.mockResolvedValue(undefined);
    const res = await activate(multipart(proof()), ctx({ id: "5" }));
    expect(res.status).toBe(200);
    expect(storeImageFileMock).toHaveBeenCalledOnce();
    expect(activateMock).toHaveBeenCalledWith({}, 5, {
      storageKey: "k.webp",
      mime: "image/webp",
      sizeBytes: 1,
    });
    expect(storageDeleteMock).not.toHaveBeenCalled();
  });

  it("aktivasi gagal setelah bukti tersimpan → rollback blob + 409", async () => {
    storeImageFileMock.mockResolvedValue({ key: "k.webp", url: "/x", mime: "image/webp", sizeBytes: 1 });
    activateMock.mockRejectedValue(new LoanError("CONFLICT", "Bukan RESERVED."));
    const res = await activate(multipart(proof()), ctx({ id: "5" }));
    expect(res.status).toBe(409);
    expect(storageDeleteMock).toHaveBeenCalledWith("k.webp");
  });
});

describe("admin return route (S3.5)", () => {
  it("return sukses → 200", async () => {
    returnLineMock.mockResolvedValue(undefined);
    const res = await returnPost(
      jsonReq("http://localhost/api/admin/loans/5/lines/9/return", { quantity: 1 }),
      ctx({ id: "5", lineId: "9" }),
    );
    expect(res.status).toBe(200);
    expect(returnLineMock).toHaveBeenCalledWith({}, 5, 9, 1);
  });

  it("jumlah tak valid → 400 VALIDATION", async () => {
    const res = await returnPost(
      jsonReq("http://localhost/api/admin/loans/5/lines/9/return", { quantity: 0 }),
      ctx({ id: "5", lineId: "9" }),
    );
    expect(res.status).toBe(400);
    expect(returnLineMock).not.toHaveBeenCalled();
  });
});

describe("admin items routes (S3.5)", () => {
  function itemForm(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return new NextRequest("http://localhost/api/admin/items", { method: "POST", body: fd });
  }

  it("POST buat barang → 201", async () => {
    createItemMock.mockResolvedValue(42);
    const res = await items.POST(itemForm({ name: "Proyektor", stockTotal: "3" }));
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe(42);
    expect(createItemMock).toHaveBeenCalledOnce();
  });

  it("POST tanpa nama → 400 VALIDATION", async () => {
    const res = await items.POST(itemForm({ stockTotal: "3" }));
    expect(res.status).toBe(400);
    expect(createItemMock).not.toHaveBeenCalled();
  });

  it("DELETE barang berriwayat → 409 CONFLICT (map CatalogError)", async () => {
    deleteItemMock.mockRejectedValue(new CatalogError("CONFLICT", "Punya riwayat."));
    const res = await itemsId.DELETE(new NextRequest("http://localhost/api/admin/items/7"), ctx({ id: "7" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("CONFLICT");
  });

  it("DELETE sukses + hapus blob foto", async () => {
    deleteItemMock.mockResolvedValue({ photoKey: "foto.webp" });
    const res = await itemsId.DELETE(new NextRequest("http://localhost/api/admin/items/7"), ctx({ id: "7" }));
    expect(res.status).toBe(200);
    expect(storageDeleteMock).toHaveBeenCalledWith("foto.webp");
  });
});

describe("admin list + notifications routes (S3.5)", () => {
  it("GET loans → 200 dengan daftar", async () => {
    listLoansMock.mockResolvedValue([{ id: 1 }]);
    const res = await loans.GET(new NextRequest("http://localhost/api/admin/loans?status=PENDING"));
    expect(res.status).toBe(200);
    expect((await res.json()).loans).toHaveLength(1);
    expect(listLoansMock).toHaveBeenCalledWith({}, { status: "PENDING" });
  });

  it("GET loans filter tak valid → 400", async () => {
    const res = await loans.GET(new NextRequest("http://localhost/api/admin/loans?status=BOGUS"));
    expect(res.status).toBe(400);
    expect(listLoansMock).not.toHaveBeenCalled();
  });

  it("POST notifications/read → markRead dipanggil", async () => {
    markReadMock.mockResolvedValue(undefined);
    const res = await notifRead.POST(jsonReq("http://localhost/api/admin/notifications/read", { ids: [1, 2] }));
    expect(res.status).toBe(200);
    expect(markReadMock).toHaveBeenCalledWith({}, [1, 2]);
  });
});
