import type { NextResponse } from "next/server";
import { CatalogError } from "@/server/catalog/admin";
import { LoanError } from "@/server/loan/service";
import { errorResponse } from "./errors";

/**
 * Pemetaan error domain (Loan/Catalog service) → amplop HTTP seragam
 * (SDD *Error Handling*). Kode domain (`CONFLICT|NOT_FOUND|VALIDATION`) sudah
 * selaras dengan `ErrorCode`. Kembalikan `null` bila bukan error domain →
 * pemanggil memetakan ke 503.
 */
export function domainErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof LoanError || err instanceof CatalogError) {
    return errorResponse(err.code, err.message);
  }
  return null;
}

/** Parse id numerik dari segmen rute; NaN → null. */
export function parseId(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
