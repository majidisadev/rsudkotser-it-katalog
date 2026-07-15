import { NextResponse } from "next/server";

/**
 * Amplop error seragam (SDD *Error Handling*): { error: { code, message } }.
 */
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "NOT_FOUND"
  | "INTERNAL"
  | "SERVICE_UNAVAILABLE";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  NOT_FOUND: 404,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
};

export function errorResponse(
  code: ErrorCode,
  message: string,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code], headers });
}
