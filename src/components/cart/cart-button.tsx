"use client";

import { ShoppingCart } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useCart } from "./cart-context";

/** Ikon keranjang berbadge (top bar publik). Membuka sheet checkout. */
export function CartButton() {
  const { count, open } = useCart();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Buka keranjang, ${count} barang`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)] active:scale-[0.92] hover:bg-surface-2"
    >
      <ShoppingCart size={20} aria-hidden />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-[600] tabular-nums text-primary-fg">
          {formatNumber(count)}
        </span>
      ) : null}
    </button>
  );
}
