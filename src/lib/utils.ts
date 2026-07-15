import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Helper kelas ala shadcn/ui — merge Tailwind tanpa konflik. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format angka gaya id-ID (pemisah ribuan) — DSD i18n. */
const idNumber = new Intl.NumberFormat("id-ID");
export function formatNumber(n: number): string {
  return idNumber.format(n);
}

/** Format tanggal manusiawi `13 Jul 2026` (DSD i18n). Menerima Date/ISO. */
const idDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : idDate.format(d);
}

/** Format tanggal + jam `13 Jul 2026, 14.30 WIB` (WIB — DSD i18n). */
const idDateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : `${idDateTime.format(d)} WIB`;
}
