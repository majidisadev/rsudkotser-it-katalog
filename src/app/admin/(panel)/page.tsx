"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboard, fetchLoans } from "@/lib/admin-client";
import { formatNumber } from "@/lib/utils";
import { LoanStatusBadge } from "@/components/admin/loan-status-badge";

/**
 * Dashboard admin (S4 / FR15) — kartu ringkasan (tersedia/sedang/akan/menunggu)
 * + aktivitas terbaru. Angka tabular-nums (DSD).
 */
export default function DashboardPage() {
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });
  const recent = useQuery({ queryKey: ["loans", {}], queryFn: () => fetchLoans({}) });

  const tiles = [
    { label: "Dipinjam", value: summary.data?.activeCount },
    { label: "Disetujui", value: summary.data?.reservedCount },
    { label: "Menunggu", value: summary.data?.pendingCount },
  ];

  return (
    <div>
      <h1 className="mb-5 text-[28px] font-[700] tracking-[-0.374px]">Dashboard</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-card border border-hairline bg-surface p-5">
            <div className="text-[14px] text-ink-muted">{t.label}</div>
            <div className="mt-1 text-[34px] font-[700] tabular-nums">
              {summary.isLoading ? "—" : formatNumber(t.value ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-[21px] font-[600]">Aktivitas terbaru</h2>
      <div className="overflow-hidden rounded-card border border-hairline bg-surface">
        {recent.isLoading ? (
          <p className="px-4 py-8 text-center text-[14px] text-ink-muted">Memuat…</p>
        ) : (recent.data?.loans.length ?? 0) === 0 ? (
          <p className="px-4 py-8 text-center text-[14px] text-ink-muted">Belum ada peminjaman.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {recent.data!.loans.slice(0, 8).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-[600]">{l.borrowerName}</div>
                  <div className="truncate text-[13px] text-ink-muted">
                    {l.borrowerUnit} · {l.itemsSummary || "—"}
                  </div>
                </div>
                <LoanStatusBadge status={l.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
