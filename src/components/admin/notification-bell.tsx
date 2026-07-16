"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  clearNotifications,
  fetchNotifications,
  markNotificationsRead,
} from "@/lib/admin-client";
import { cn, formatDate } from "@/lib/utils";

/**
 * NotificationBell (DSD, ADR-010) — badge unread + popover daftar via **polling**
 * (refetch tiap 15 dtk). Klik notifikasi → buka Peminjaman & tandai baca.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 15_000,
  });

  const markRead = useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const clearAll = useMutation({
    mutationFn: () => clearNotifications(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  const unread = data?.unread ?? 0;
  const items = data?.notifications ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform hover:bg-surface-2 active:scale-[0.96]"
      >
        <Bell size={20} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-[700] tabular-nums text-primary-fg">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-card border border-hairline bg-surface shadow-[var(--shadow-float)]"
          role="dialog"
          aria-label="Daftar notifikasi"
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="text-[15px] font-[600]">Notifikasi</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(undefined)}
                  aria-label="Tandai semua dibaca"
                  title="Tandai semua dibaca"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-surface-2"
                >
                  <CheckCheck size={17} aria-hidden />
                </button>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearAll.mutate()}
                  aria-label="Hapus semua notifikasi"
                  title="Hapus semua notifikasi"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-surface-2"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-[14px] text-ink-muted">Belum ada notifikasi.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead.mutate([n.id]);
                      setOpen(false);
                      if (n.loanId) router.push("/admin/peminjaman");
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-surface-2",
                      !n.isRead && "bg-primary/5",
                    )}
                  >
                    <span className="text-[14px] text-ink">{n.message}</span>
                    <span className="text-[12px] text-ink-muted">{formatDate(n.createdAt)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
