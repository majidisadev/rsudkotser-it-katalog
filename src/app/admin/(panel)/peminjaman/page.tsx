"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ApiError,
  approveLoan,
  cancelLoan,
  fetchLoans,
  rejectLoan,
} from "@/lib/admin-client";
import type { LoanListRow } from "@/server/loan/queries";
import { DataTable } from "@/components/admin/data-table";
import { LoanDetailDialog } from "@/components/admin/loan-detail-dialog";
import { LoanStatusBadge } from "@/components/admin/loan-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS = [
  ["", "Semua status"],
  ["PENDING", "Menunggu"],
  ["RESERVED", "Disetujui"],
  ["ACTIVE", "Dipinjam"],
  ["RETURNED", "Selesai"],
  ["REJECTED", "Ditolak"],
  ["CANCELLED", "Dibatalkan"],
] as const;

/** Admin Peminjaman (S6, FR7/FR8/FR9/FR13) — tabel + aksi kontekstual + detail. */
export default function PeminjamanPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const filter = {
    status: status || undefined,
    type: type || undefined,
    q: q.trim() || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const loansQ = useQuery({ queryKey: ["loans", filter], queryFn: () => fetchLoans(filter) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const onError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : "Gagal memproses aksi.");

  const approve = useMutation({
    mutationFn: approveLoan,
    onSuccess: () => {
      invalidate();
      toast.success("Booking disetujui.");
    },
    onError,
  });
  const reject = useMutation({
    mutationFn: rejectLoan,
    onSuccess: () => {
      invalidate();
      toast.success("Booking ditolak.");
    },
    onError,
  });
  const cancel = useMutation({
    mutationFn: cancelLoan,
    onSuccess: () => {
      invalidate();
      toast.success("Reservasi dibatalkan, stok dikembalikan.");
    },
    onError,
  });

  const busy = approve.isPending || reject.isPending || cancel.isPending;

  const columns = useMemo<ColumnDef<LoanListRow, unknown>[]>(
    () => [
      {
        accessorKey: "borrowerName",
        header: "Peminjam",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-[600]">{row.original.borrowerName}</div>
            <div className="truncate text-[12px] text-ink-muted">{row.original.itemsSummary || "—"}</div>
          </div>
        ),
      },
      { accessorKey: "borrowerUnit", header: "Unit" },
      {
        accessorKey: "type",
        header: "Tipe",
        cell: ({ getValue }) => (getValue() === "BOOKING" ? "Booking" : "Langsung"),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <LoanStatusBadge status={String(getValue())} />,
      },
      {
        id: "aksi",
        header: "Aksi",
        enableSorting: false,
        cell: ({ row }) => {
          const l = row.original;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {l.status === "PENDING" && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => approve.mutate(l.id)}>
                    Setujui
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => reject.mutate(l.id)}>
                    Tolak
                  </Button>
                </>
              )}
              {l.status === "RESERVED" && (
                <>
                  <Button size="sm" onClick={() => setDetailId(l.id)}>
                    Diambil
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => cancel.mutate(l.id)}>
                    Batalkan
                  </Button>
                </>
              )}
              {l.status === "ACTIVE" && (
                <Button size="sm" onClick={() => setDetailId(l.id)}>
                  Kembalikan
                </Button>
              )}
              <button
                type="button"
                onClick={() => setDetailId(l.id)}
                aria-label={`Detail peminjaman ${l.borrowerName}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
              >
                <Eye size={18} aria-hidden />
              </button>
            </div>
          );
        },
      },
    ],
    [approve, reject, cancel, busy],
  );

  const rows = loansQ.data?.loans ?? [];

  return (
    <div>
      <h1 className="mb-5 text-[28px] font-[700] tracking-[-0.374px]">Peminjaman</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari peminjam / unit…"
          className="max-w-xs"
          aria-label="Cari peminjaman"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status"
          className="h-11 rounded-full border border-hairline bg-surface px-4 text-[15px] text-ink"
        >
          {STATUS_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter tipe"
          className="h-11 rounded-full border border-hairline bg-surface px-4 text-[15px] text-ink"
        >
          <option value="">Semua tipe</option>
          <option value="DIRECT">Langsung</option>
          <option value="BOOKING">Booking</option>
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          Dari
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Tanggal peminjaman dari"
            className="h-11 rounded-full border border-hairline bg-surface px-3 text-[14px] text-ink"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          Sampai
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Tanggal peminjaman sampai"
            className="h-11 rounded-full border border-hairline bg-surface px-3 text-[14px] text-ink"
          />
        </label>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="text-[13px] font-[600] text-primary"
          >
            Reset tanggal
          </button>
        )}
      </div>

      {loansQ.isLoading ? (
        <p className="rounded-card border border-hairline bg-surface px-4 py-10 text-center text-[14px] text-ink-muted">
          Memuat…
        </p>
      ) : loansQ.isError ? (
        <div className="rounded-card border border-hairline bg-surface px-4 py-10 text-center">
          <p className="text-[14px] text-ink-muted">Gagal memuat peminjaman.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => loansQ.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-hairline bg-surface px-4 py-10 text-center text-[14px] text-ink-muted">
          Belum ada peminjaman.
        </p>
      ) : (
        <DataTable columns={columns} data={rows} pageSize={20} />
      )}

      {detailId !== null && (
        <LoanDetailDialog loanId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
