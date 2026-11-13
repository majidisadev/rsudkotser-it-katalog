"use client";

import { ShoppingCart, X } from "lucide-react";
import { useEffect } from "react";
import { useCart } from "./cart-context";

/**
 * Popover onboarding di bawah tombol keranjang — tampil sekali, saat pengguna
 * pertama kali menambah barang di halaman utama. Selesai (dan tak tampil lagi)
 * bila keranjang dibuka atau petunjuk ditutup ("Mengerti"/×/Esc). Non-modal:
 * fokus tak dirampas; `role=status` mengumumkan petunjuk ke pembaca layar.
 *
 * Posisi: tombol login (40px + gap 4px) selalu di kanan keranjang, jadi popover
 * digeser `-right-11` agar tepi kanannya sejajar gutter header & panahnya tepat
 * menunjuk ikon keranjang.
 */
export function CartHint() {
  const { open, dismissHint } = useCart();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissHint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissHint]);

  return (
    <div
      id="cart-hint"
      role="status"
      className="absolute -right-11 top-full z-20 mt-3 w-[min(20rem,calc(100vw-2rem))] origin-top-right animate-[hint-in_var(--dur-base)_var(--ease-out)] rounded-card border border-hairline bg-surface p-4 text-left shadow-[var(--shadow-float)]"
    >
      <span
        aria-hidden
        className="absolute -top-[6px] right-[59px] h-2.5 w-2.5 rotate-45 border-l border-t border-hairline bg-surface"
      />
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <ShoppingCart size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-[600] text-ink">Barang masuk keranjang</p>
          <p className="mt-0.5 text-[14px] leading-snug text-ink-muted text-pretty">
            Ketuk ikon keranjang di atas untuk melihat barang pilihan dan mengajukan peminjaman.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissHint}
          aria-label="Tutup petunjuk"
          className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismissHint}
          className="rounded-full px-4 py-2 text-[14px] font-[600] text-primary hover:bg-surface-2"
        >
          Mengerti
        </button>
        <button
          type="button"
          onClick={open}
          className="rounded-full bg-primary px-4 py-2 text-[14px] font-[600] text-primary-fg transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)] active:scale-[0.96] hover:bg-primary-hover"
        >
          Lihat keranjang
        </button>
      </div>
    </div>
  );
}
