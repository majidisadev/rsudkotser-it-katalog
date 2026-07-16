"use client";

import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

/**
 * Panel filter peminjaman (S4.2) — menyatukan seluruh filter tabel (status,
 * tipe, barang, rentang tanggal) ke dalam satu **popover** agar toolbar ringkas.
 * Filter **barang** berupa daftar checkbox multi-pilih. Tombol pemicu menampilkan
 * badge jumlah grup filter aktif. Tutup via klik-luar / Escape (a11y).
 */

export interface LoanFilters {
  status: string;
  type: string;
  itemIds: number[];
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_LOAN_FILTERS: LoanFilters = {
  status: "",
  type: "",
  itemIds: [],
  dateFrom: "",
  dateTo: "",
};

const STATUS_OPTIONS: readonly (readonly [string, string])[] = [
  ["", "Semua status"],
  ["PENDING", "Menunggu"],
  ["RESERVED", "Disetujui"],
  ["ACTIVE", "Dipinjam"],
  ["RETURNED", "Selesai"],
  ["REJECTED", "Ditolak"],
  ["CANCELLED", "Dibatalkan"],
];

export function activeFilterCount(f: LoanFilters): number {
  return (
    (f.status ? 1 : 0) +
    (f.type ? 1 : 0) +
    (f.itemIds.length ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0)
  );
}

const selectClass =
  "h-11 w-full rounded-inline border border-hairline bg-surface px-3 text-[15px] text-ink";

/** `YYYY-MM-DD` → Date lokal (hindari geser TZ dari `new Date("YYYY-MM-DD")` UTC). */
function parseYmd(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Date lokal → `YYYY-MM-DD`. */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LoanFilterPanel({
  filters,
  onChange,
  items,
  itemsLoading = false,
}: {
  filters: LoanFilters;
  onChange: (next: LoanFilters) => void;
  items: { id: number; name: string }[];
  itemsLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const set = (patch: Partial<LoanFilters>) => onChange({ ...filters, ...patch });
  const toggleItem = (id: number) =>
    set({
      itemIds: filters.itemIds.includes(id)
        ? filters.itemIds.filter((x) => x !== id)
        : [...filters.itemIds, id],
    });

  const range: DateRange | undefined = useMemo(() => {
    const from = parseYmd(filters.dateFrom);
    const to = parseYmd(filters.dateTo);
    return from || to ? { from, to } : undefined;
  }, [filters.dateFrom, filters.dateTo]);
  const onRangeSelect = (next: DateRange | undefined) =>
    set({
      dateFrom: next?.from ? toYmd(next.from) : "",
      dateTo: next?.to ? toYmd(next.to) : "",
    });
  const rangeLabel =
    range?.from && range.to
      ? `${formatDate(range.from)} – ${formatDate(range.to)}`
      : range?.from
        ? `${formatDate(range.from)} – …`
        : "Semua tanggal";

  const count = activeFilterCount(filters);
  const visibleItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, itemQuery]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[15px] font-[600] text-ink hover:bg-surface-2"
      >
        <SlidersHorizontal size={16} aria-hidden />
        Filter
        {count > 0 && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[12px] font-[700] tabular-nums text-primary-fg"
            aria-label={`${count} filter aktif`}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter peminjaman"
          className="absolute left-0 z-40 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-card border border-hairline bg-surface p-4 shadow-[var(--shadow-float)]"
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-[600] text-ink-muted">Status</span>
              <select
                value={filters.status}
                onChange={(e) => set({ status: e.target.value })}
                className={selectClass}
              >
                {STATUS_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-[600] text-ink-muted">Tipe</span>
              <select
                value={filters.type}
                onChange={(e) => set({ type: e.target.value })}
                className={selectClass}
              >
                <option value="">Semua tipe</option>
                <option value="DIRECT">Langsung</option>
                <option value="BOOKING">Booking</option>
              </select>
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] font-[600] text-ink-muted">
                Barang{filters.itemIds.length > 0 ? ` (${filters.itemIds.length})` : ""}
              </legend>
              <Input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder="Cari barang…"
                aria-label="Cari barang untuk filter"
                className="h-10 text-[14px]"
              />
              <div className="max-h-44 overflow-y-auto rounded-inline border border-hairline">
                {itemsLoading ? (
                  <p className="px-3 py-4 text-center text-[13px] text-ink-muted">Memuat barang…</p>
                ) : visibleItems.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[13px] text-ink-muted">
                    Tidak ada barang.
                  </p>
                ) : (
                  visibleItems.map((it) => (
                    <label
                      key={it.id}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[14px] text-ink hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={filters.itemIds.includes(it.id)}
                        onChange={() => toggleItem(it.id)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span className="truncate">{it.name}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-[600] text-ink-muted">Tanggal peminjaman</span>
              <button
                type="button"
                onClick={() => setDateOpen((v) => !v)}
                aria-expanded={dateOpen}
                aria-label="Pilih rentang tanggal peminjaman"
                className={`${selectClass} flex items-center gap-2 text-left ${
                  range ? "text-ink" : "text-ink-muted"
                }`}
              >
                <CalendarDays size={16} aria-hidden className="shrink-0 text-ink-muted" />
                <span className="truncate">{rangeLabel}</span>
              </button>
              {dateOpen && (
                <div className="mt-1 flex flex-col items-center rounded-inline border border-hairline bg-surface p-1">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={onRangeSelect}
                    defaultMonth={range?.from}
                    numberOfMonths={1}
                  />
                  {range && (
                    <button
                      type="button"
                      onClick={() => onRangeSelect(undefined)}
                      className="mb-1 text-[13px] font-[600] text-primary"
                    >
                      Hapus tanggal
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => {
                  onChange(EMPTY_LOAN_FILTERS);
                  setItemQuery("");
                }}
                disabled={count === 0}
                className="text-[14px] font-[600] text-primary disabled:opacity-40"
              >
                Reset filter
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-ink px-4 py-2 text-[14px] font-[600] text-surface"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
