"use client";

import { ShoppingCart } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useCart } from "./cart-context";
import { CartHint } from "./cart-hint";

/**
 * Ikon keranjang berbadge (top bar publik). Membuka sheet checkout. Saat barang
 * pertama ditambah, tampil petunjuk onboarding (CartHint) + cincin denyut (3×,
 * lalu diam) agar pengguna baru tahu keranjang dibuka lewat tombol ini.
 */
export function CartButton() {
  const { count, open, hintOpen } = useCart();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={open}
        aria-label={`Buka keranjang, ${count} barang`}
        aria-describedby={hintOpen ? "cart-hint" : undefined}
        className="press relative flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2 pointer-coarse:h-11 pointer-coarse:w-11"
      >
        {hintOpen ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-[cart-pulse_1.6s_var(--ease-out)_3] rounded-full ring-2 ring-primary"
          />
        ) : null}
        <ShoppingCart size={20} aria-hidden />
        {count > 0 ? (
          <span
            key={count}
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 animate-[badge-pop_200ms_var(--ease-out)] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-[600] tabular-nums text-primary-fg"
          >
            {formatNumber(count)}
          </span>
        ) : null}
      </button>
      {hintOpen ? <CartHint /> : null}
    </div>
  );
}
