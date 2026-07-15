"use client";

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useState } from "react";

/**
 * DataTable admin (DSD DataTable) — TanStack Table headless: header sticky,
 * sortable, baris hover. Menggulir horizontal di layar sempit (mode kartu penuh
 * ditunda — poles Sprint 04). Empty/loading di-handle pemanggil. `pageSize`
 * opsional → aktifkan paginasi client + kontrol prev/next.
 */
export function DataTable<T>({
  columns,
  data,
  pageSize,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageSize?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pageSize
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {}),
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
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === "asc" ? (
                          <ChevronUp size={14} aria-hidden />
                        ) : dir === "desc" ? (
                          <ChevronDown size={14} aria-hidden />
                        ) : null}
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
            <tr key={row.id} className="transition-colors hover:bg-surface-2">
              {row.getVisibleCells().map((cell) => (
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
          Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount()} ·{" "}
          {table.getRowCount()} peminjaman
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Halaman sebelumnya"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Halaman berikutnya"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>
    )}
    </div>
  );
}
