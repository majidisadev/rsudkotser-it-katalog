"use client";

import {
  type ColumnDef,
  type RowData,
  type SortingState,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

/**
 * Fitur TanStack Table v9 yang dipakai tabel admin (eksplisit → tree-shaking).
 * Stabil di level modul (syarat v9). sortFns = fungsi yang dipilih `sortFn: "auto"`
 * (setara perilaku sort otomatis v8).
 */
export const adminTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
});

/** Definisi kolom untuk `DataTable` (fitur admin terikat di tipe). */
export type AdminColumnDef<T extends RowData> = ColumnDef<typeof adminTableFeatures, T>;

/**
 * DataTable admin (DSD DataTable) — TanStack Table headless: header sticky,
 * sortable, baris hover. Menggulir horizontal di layar sempit (mode kartu penuh
 * ditunda — poles Sprint 04). Empty/loading di-handle pemanggil. `pageSize`
 * opsional → aktifkan paginasi client + kontrol prev/next.
 */
export function DataTable<T extends RowData>({
  columns,
  data,
  pageSize,
}: {
  columns: AdminColumnDef<T>[];
  data: T[];
  pageSize?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features: adminTableFeatures,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    // Tanpa pageSize → paginasi manual (data tampil utuh, tak diiris).
    manualPagination: !pageSize,
    ...(pageSize ? { initialState: { pagination: { pageIndex: 0, pageSize } } } : {}),
  });

  const paged = pageSize != null && table.getPageCount() > 1;

  return (
    <div className="flex flex-col gap-3">
    <div className="overflow-x-auto rounded-card border border-hairline bg-surface">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-surface-2">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const sortable = h.column.getCanSort();
                const dir = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    className="whitespace-nowrap px-4 py-3 font-[600] text-ink-muted"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="group -mx-1 inline-flex items-center gap-1 rounded-inline px-1 transition-colors duration-[var(--dur-fast)] hover:text-ink"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {/* Ikon selalu ada (lebar tetap) → header tak bergeser saat diurutkan. */}
                        {dir === "asc" ? (
                          <ChevronUp size={14} aria-hidden className="text-ink" />
                        ) : dir === "desc" ? (
                          <ChevronDown size={14} aria-hidden className="text-ink" />
                        ) : (
                          <ChevronsUpDown
                            size={14}
                            aria-hidden
                            className="opacity-50 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100"
                          />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-hairline">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="transition-colors duration-[var(--dur-fast)] hover:bg-surface-2/60">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {paged && (
      <div className="flex items-center justify-between px-1 text-[13px] text-ink-muted">
        <span className="tabular-nums">
          Halaman {table.state.pagination.pageIndex + 1} dari {table.getPageCount()} ·{" "}
          {table.getRowCount()} peminjaman
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Halaman sebelumnya"
            className="press inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Halaman berikutnya"
            className="press inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>
    )}
    </div>
  );
}
