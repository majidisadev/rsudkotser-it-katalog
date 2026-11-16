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
        className="press relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2 pointer-coarse:h-11 pointer-coarse:w-11"
      >
        <Bell size={20} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-[600] tabular-nums text-primary-fg">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          // Tepi kanan sejajar gutter header (melewati toggle tema 40/44px + gap
          // 4px) → lebar penuh muat di layar 375px tanpa terpotong di kiri.
          className="absolute -right-11 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right animate-[popover-in_var(--dur-fast)_var(--ease-out)] overflow-hidden rounded-card border border-transparent bg-surface shadow-[var(--shadow-menu)] pointer-coarse:-right-12"
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
                  className="press -my-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-link hover:bg-surface-2"
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
                  className="press -my-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-danger hover:bg-surface-2"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto overscroll-contain">
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
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-[var(--dur-fast)] hover:bg-surface-2",
                      !n.isRead && "bg-primary/5",
                    )}
                  >
                    {/* Belum dibaca: titik + teks tersembunyi, bukan warna latar saja. */}
                    <span
                      aria-hidden
                      className={cn(
                        "mt-[7px] h-2 w-2 shrink-0 rounded-full",
                        n.isRead ? "bg-transparent" : "bg-primary",
                      )}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[14px] text-ink text-pretty">
                        {!n.isRead && <span className="sr-only">Belum dibaca: </span>}
                        {n.message}
                      </span>
                      <span className="text-[12px] tabular-nums text-ink-muted">
                        {formatDate(n.createdAt)}
                      </span>
                    </span>
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
