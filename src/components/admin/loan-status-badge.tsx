import { cn } from "@/lib/utils";

/**
 * Chip status peminjaman (DSD) — pasangan tint+teks + LABEL TEKS (bukan warna
 * saja; a11y/buta warna). Label Indonesia sesuai state machine SDD.
 */
const MAP: Record<string, { label: string; cls: string; strike?: boolean }> = {
  PENDING: { label: "Menunggu", cls: "bg-st-pending-bg text-st-pending-fg" },
  RESERVED: { label: "Disetujui", cls: "bg-st-reserved-bg text-st-reserved-fg" },
  ACTIVE: { label: "Dipinjam", cls: "bg-st-active-bg text-st-active-fg" },
  RETURNED: { label: "Selesai", cls: "bg-st-returned-bg text-st-returned-fg" },
  REJECTED: { label: "Ditolak", cls: "bg-st-rejected-bg text-st-rejected-fg" },
  CANCELLED: { label: "Dibatalkan", cls: "bg-st-cancelled-bg text-st-cancelled-fg", strike: true },
};

export function LoanStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-surface-2 text-ink-muted" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-[600]",
        s.cls,
        s.strike && "line-through",
      )}
    >
      {s.label}
    </span>
  );
}
