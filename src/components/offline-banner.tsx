"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/use-online-status";

/**
 * Bar offline global (S4.4) — muncul saat koneksi putus. Ink pekat + teks (bukan
 * warna saja) demi kontras & a11y (WCAG). `role=status` mengumumkan perubahan.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-[13px] font-[600] text-canvas"
    >
      <WifiOff size={15} aria-hidden />
      Anda sedang offline — sebagian aksi mungkin gagal sampai koneksi kembali.
    </div>
  );
}
