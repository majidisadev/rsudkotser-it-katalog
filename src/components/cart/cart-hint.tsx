"use client";

import { useEffect } from "react";
import { useCart } from "./cart-context";

/**
 * Popover onboarding di bawah tombol keranjang — tampil sekali, saat pengguna
 * pertama kali menambah barang di halaman utama. Selesai (dan tak tampil lagi)
 * bila keranjang dibuka atau petunjuk ditutup ("Mengerti"/Esc). Non-modal:
 * fokus tak dirampas; `role=status` mengumumkan petunjuk ke pembaca layar.
 *
 * Posisi: tombol login (40px + gap 4px; 44px di layar sentuh) selalu di kanan
 * keranjang, jadi popover digeser `-right-11` / `-right-12` agar tepi kanannya
 * sejajar gutter header & panahnya tepat menunjuk ikon keranjang.
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
      className="absolute -right-11 top-full pointer-coarse:-right-12 z-20 mt-3 w-[min(20rem,calc(100vw-2rem))] origin-top-right animate-[hint-in_var(--dur-base)_var(--ease-out)] rounded-card border border-transparent bg-surface p-4 text-left shadow-[var(--shadow-menu)]"
    >
      <span
        aria-hidden
        className="absolute -top-[5px] right-[59px] h-2.5 pointer-coarse:right-[65px] w-2.5 rotate-45 bg-surface shadow-[-1px_-1px_0_0_var(--hairline)]"
      />
      <p className="text-[15px] font-[600] text-ink">Barang masuk keranjang</p>
      <p className="mt-1 text-[14px] leading-snug text-ink-muted text-pretty">
        Ketuk ikon keranjang di atas untuk melihat barang pilihan dan mengajukan peminjaman.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismissHint}
          className="press h-10 rounded-full px-4 text-[14px] font-[600] text-link hover:bg-surface-2"
        >
          Mengerti
        </button>
        <button
          type="button"
          onClick={open}
          className="press h-10 rounded-full bg-primary px-4 text-[14px] font-[600] text-primary-fg hover:bg-primary-hover"
        >
          Lihat keranjang
        </button>
      </div>
    </div>
  );
}
