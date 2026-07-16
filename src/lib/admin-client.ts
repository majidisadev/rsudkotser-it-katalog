import type { AdminItemDTO } from "@/server/catalog/admin";
import type { DashboardSummary, LoanDetail, LoanListRow } from "@/server/loan/queries";
import type { NotificationDTO } from "@/server/notification/service";

/**
 * Klien fetch admin (client-side) — pembungkus tipis atas `/api/admin/*` dengan
 * penguraian amplop error seragam (SDD Error Handling) menjadi `ApiError`.
 * Dipakai oleh hook TanStack Query di komponen admin. Import tipe DTO bersifat
 * type-only (di-erase) → tak menarik kode server ke bundle client.
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let code = "INTERNAL";
  let message = "Terjadi kesalahan. Coba lagi.";
  try {
    const body = await res.json();
    code = body?.error?.code ?? code;
    message = body?.error?.message ?? message;
  } catch {
    /* respons non-JSON */
  }
  throw new ApiError(code, message);
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// ── Auth ─────────────────────────────────────────────────────────────────────
export const login = (password: string) =>
  fetch("/api/admin/login", json("POST", { password })).then((r) => parse<{ ok: true }>(r));
export const logout = () =>
  fetch("/api/admin/logout", json("POST")).then((r) => parse<{ ok: true }>(r));

// ── Barang ───────────────────────────────────────────────────────────────────
export const fetchItems = (q?: string) =>
  fetch(`/api/admin/items${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) =>
    parse<{ items: AdminItemDTO[] }>(r),
  );
export const createItem = (form: FormData) =>
  fetch("/api/admin/items", { method: "POST", body: form }).then((r) => parse<{ id: number }>(r));
export const updateItem = (id: number, form: FormData) =>
  fetch(`/api/admin/items/${id}`, { method: "PATCH", body: form }).then((r) => parse<{ ok: true }>(r));
export const deleteItem = (id: number) =>
  fetch(`/api/admin/items/${id}`, { method: "DELETE" }).then((r) => parse<{ ok: true }>(r));

// ── Kategori ─────────────────────────────────────────────────────────────────
export interface CategoryRow {
  id: number;
  name: string;
}
export const fetchCategories = () =>
  fetch("/api/admin/categories").then((r) => parse<{ categories: CategoryRow[] }>(r));
export const createCategory = (name: string) =>
  fetch("/api/admin/categories", json("POST", { name })).then((r) => parse<{ id: number }>(r));
export const updateCategory = (id: number, name: string) =>
  fetch(`/api/admin/categories/${id}`, json("PATCH", { name })).then((r) => parse<{ ok: true }>(r));
export const deleteCategory = (id: number) =>
  fetch(`/api/admin/categories/${id}`, { method: "DELETE" }).then((r) => parse<{ ok: true }>(r));

// ── Peminjaman ───────────────────────────────────────────────────────────────
export interface LoansFilter {
  status?: string;
  type?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  itemIds?: number[];
}
/** Query string bersama tabel + ekspor (itemId dikirim berulang). */
export function buildLoansParams(filter: LoansFilter): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.status) sp.set("status", filter.status);
  if (filter.type) sp.set("type", filter.type);
  if (filter.q) sp.set("q", filter.q);
  if (filter.dateFrom) sp.set("dateFrom", filter.dateFrom);
  if (filter.dateTo) sp.set("dateTo", filter.dateTo);
  for (const id of filter.itemIds ?? []) sp.append("itemId", String(id));
  return sp;
}
export const fetchLoans = (filter: LoansFilter = {}) => {
  const qs = buildLoansParams(filter).toString();
  return fetch(`/api/admin/loans${qs ? `?${qs}` : ""}`).then((r) => parse<{ loans: LoanListRow[] }>(r));
};
/** URL unduhan ekspor Excel dengan filter aktif (FR13, filter-aware). */
export function loansExportUrl(filter: LoansFilter = {}): string {
  const qs = buildLoansParams(filter).toString();
  return `/api/admin/loans/export${qs ? `?${qs}` : ""}`;
}

export type LoanDetailResponse = Omit<LoanDetail, "proofs"> & {
  proofs: { id: number; kind: string; mime: string; createdAt: string; url: string }[];
};
export const fetchLoanDetail = (id: number) =>
  fetch(`/api/admin/loans/${id}`).then((r) => parse<{ loan: LoanDetailResponse }>(r));

export const approveLoan = (id: number) =>
  fetch(`/api/admin/loans/${id}/approve`, json("POST")).then((r) => parse<{ ok: true }>(r));
export const rejectLoan = (id: number) =>
  fetch(`/api/admin/loans/${id}/reject`, json("POST")).then((r) => parse<{ ok: true }>(r));
export const cancelLoan = (id: number) =>
  fetch(`/api/admin/loans/${id}/cancel`, json("POST")).then((r) => parse<{ ok: true }>(r));
export const activateLoan = (id: number, form: FormData) =>
  fetch(`/api/admin/loans/${id}/activate`, { method: "POST", body: form }).then((r) =>
    parse<{ ok: true }>(r),
  );
export const patchLine = (loanId: number, lineId: number, quantity: number) =>
  fetch(`/api/admin/loans/${loanId}/lines/${lineId}`, json("PATCH", { quantity })).then((r) =>
    parse<{ ok: true }>(r),
  );
export const returnLine = (loanId: number, lineId: number, quantity: number) =>
  fetch(`/api/admin/loans/${loanId}/lines/${lineId}/return`, json("POST", { quantity })).then((r) =>
    parse<{ ok: true }>(r),
  );
export const undoReturn = (loanId: number, lineId: number, quantity: number) =>
  fetch(`/api/admin/loans/${loanId}/lines/${lineId}/return/undo`, json("POST", { quantity })).then(
    (r) => parse<{ ok: true }>(r),
  );
export const deleteProof = (proofId: number) =>
  fetch(`/api/admin/proofs/${proofId}`, { method: "DELETE" }).then((r) => parse<{ ok: true }>(r));

// ── Dashboard ────────────────────────────────────────────────────────────────
export const fetchDashboard = () =>
  fetch("/api/admin/dashboard").then((r) => parse<DashboardSummary>(r));

// ── Notifikasi ───────────────────────────────────────────────────────────────
export const fetchNotifications = () =>
  fetch("/api/admin/notifications").then((r) =>
    parse<{ notifications: NotificationDTO[]; unread: number }>(r),
  );
export const markNotificationsRead = (ids?: number[]) =>
  fetch("/api/admin/notifications/read", json("POST", ids ? { ids } : {})).then((r) =>
    parse<{ ok: true }>(r),
  );
export const clearNotifications = (ids?: number[]) =>
  fetch("/api/admin/notifications", json("DELETE", ids ? { ids } : {})).then((r) =>
    parse<{ ok: true }>(r),
  );
