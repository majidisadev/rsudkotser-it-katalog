"use client";

import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ItemDTO } from "@/lib/validation/items";
import { lineKey, lineMax, type CartItemMeta } from "@/lib/cart";
import { useCart } from "./cart-context";
import { QuantityStepper } from "./quantity-stepper";

/**
 * Kontrol tambah-ke-keranjang pada ItemCard (S2). Semua status (Tambah /
 * Booking / stepper / nonaktif) setinggi 44px → kartu tak melompat saat
 * tombol berganti jadi stepper. Barang tanpa varian: tombol
 * "Tambah" → QuantityStepper. Habis → tombol "Booking": barang masuk keranjang
 * sebagai baris booking-only (checkout otomatis mode booking — stok baru
 * divalidasi saat admin approve). Stok total 0 → nonaktif. Barang bervarian
 * ditangani Sprint 04 (mode varian) — di sini hanya menampilkan ketersediaan.
 */
export function AddToCart({ item }: { item: ItemDTO }) {
  const { qtyOf, increment, decrement } = useCart();

  if (item.hasVariants) {
    return <p className="text-[13px] text-ink-muted">Tersedia dalam beberapa varian.</p>;
  }

  const habis = item.available <= 0;
  const meta: CartItemMeta = {
    itemId: item.id,
    variantId: null,
    name: item.name,
    available: item.available,
    photoUrl: item.photoUrl,
    ...(habis ? { bookingOnly: true, stockTotal: item.stockTotal } : {}),
  };
  const qty = qtyOf(item.id, null);

  if (habis && item.stockTotal <= 0) {
    return (
      <button
        type="button"
        disabled
        className="h-11 w-full rounded-full border border-hairline px-4 text-[14px] font-[600] text-ink-disabled"
      >
        Tidak bisa dipinjam
      </button>
    );
  }

  if (habis && qty === 0) {
    return (
      <button
        type="button"
        onClick={() => {
          increment(meta);
          toast.success(`${item.name} masuk keranjang sebagai booking.`, {
            description: "Keranjang otomatis diajukan sebagai booking.",
          });
        }}
        className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-link px-4 text-[14px] font-[600] text-link hover:bg-primary/5"
      >
        <CalendarClock size={16} aria-hidden />
        Booking
      </button>
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => increment(meta)}
        className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-[600] text-primary-fg hover:bg-primary-hover"
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
        max={lineMax(meta)}
        onIncrement={() => increment(meta)}
        onDecrement={() => decrement(lineKey(item.id, null))}
        label={item.name}
      />
    </div>
  );
}
