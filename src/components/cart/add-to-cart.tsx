"use client";

import { Plus } from "lucide-react";
import type { ItemDTO } from "@/lib/validation/items";
import { lineKey, type CartItemMeta } from "@/lib/cart";
import { useCart } from "./cart-context";
import { QuantityStepper } from "./quantity-stepper";

/**
 * Kontrol tambah-ke-keranjang pada ItemCard (S2). Barang tanpa varian: tombol
 * "Tambah" → QuantityStepper. Habis → nonaktif. Barang bervarian ditangani
 * Sprint 04 (mode varian) — di sini hanya menampilkan ketersediaan.
 */
export function AddToCart({ item }: { item: ItemDTO }) {
  const { qtyOf, increment, decrement } = useCart();

  if (item.hasVariants) {
    return <p className="text-[13px] text-ink-muted">Tersedia dalam beberapa varian.</p>;
  }

  const meta: CartItemMeta = {
    itemId: item.id,
    variantId: null,
    name: item.name,
    available: item.available,
    photoUrl: item.photoUrl,
  };
  const qty = qtyOf(item.id, null);

  if (item.available <= 0) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-full border border-hairline px-4 py-2 text-[14px] font-[600] text-ink-disabled"
      >
        Habis
      </button>
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => increment(meta)}
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[14px] font-[600] text-primary-fg transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)] active:scale-[0.96] hover:bg-primary-hover"
      >
        <Plus size={16} aria-hidden />
        Tambah
      </button>
    );
  }

  return (
    <div className="flex justify-center">
      <QuantityStepper
        quantity={qty}
        max={item.available}
        onIncrement={() => increment(meta)}
        onDecrement={() => decrement(lineKey(item.id, null))}
        label={item.name}
      />
    </div>
  );
}
