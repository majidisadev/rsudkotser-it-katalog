"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import {
  cartCount,
  cartReducer,
  lineKey,
  type CartItemMeta,
  type CartLine,
} from "@/lib/cart";

// Sheet checkout (Radix Dialog, kamera, kanvas tanda tangan) tak dibutuhkan saat
// halaman dimuat → chunk terpisah, di-prefetch saat idle, di-mount saat dibuka.
const loadCheckoutSheet = () => import("./checkout-sheet");
const CheckoutSheet = dynamic(() => loadCheckoutSheet().then((m) => m.CheckoutSheet), {
  ssr: false,
});

const STORAGE_KEY = "katalog:cart:v1";
/** Penanda onboarding keranjang sudah dipahami (petunjuk cukup tampil sekali). */
const ONBOARDING_KEY = "katalog:onboarding:cart:v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  qtyOf: (itemId: number, variantId: number | null) => number;
  increment: (meta: CartItemMeta) => void;
  decrement: (key: string) => void;
  setQuantity: (meta: CartItemMeta, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Petunjuk onboarding "buka keranjang" — tampil saat barang pertama ditambah. */
  hintOpen: boolean;
  dismissHint: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart harus di dalam <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [isOpen, setOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Default `true` sampai localStorage terbaca → petunjuk tak muncul sebelum hydrate.
  const [onboarded, setOnboarded] = useState(true);
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => void loadCheckoutSheet());
  }, []);

  // Hydrate dari localStorage sekali di client (hindari mismatch SSR). setState
  // di effect di sini sah: sinkron satu kali dari sistem eksternal pasca-hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", lines: JSON.parse(raw) as CartLine[] });
    } catch {
      /* localStorage tak tersedia / korup — mulai keranjang kosong. */
    }
    try {
      setOnboarded(localStorage.getItem(ONBOARDING_KEY) === "1");
    } catch {
      /* Tanpa storage: anggap sudah paham — jangan ganggu tiap kunjungan. */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist tiap perubahan (setelah hydrate agar tak menimpa dengan kosong).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* kuota/privasi — abaikan. */
    }
  }, [lines, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    // Petunjuk selesai (tutup / keranjang dibuka) → jangan tampil lagi.
    const finishOnboarding = () => {
      setHintOpen(false);
      if (onboarded) return;
      setOnboarded(true);
      try {
        localStorage.setItem(ONBOARDING_KEY, "1");
      } catch {
        /* kuota/privasi — petunjuk mungkin tampil lagi di kunjungan berikut. */
      }
    };
    return {
      lines,
      count: cartCount(lines),
      qtyOf: (itemId, variantId) => {
        const key = lineKey(itemId, variantId);
        return lines.find((l) => lineKey(l.itemId, l.variantId) === key)?.quantity ?? 0;
      },
      increment: (meta) => {
        dispatch({ type: "increment", meta });
        if (!onboarded) setHintOpen(true);
      },
      decrement: (key) => dispatch({ type: "decrement", key }),
      setQuantity: (meta, quantity) => dispatch({ type: "setQuantity", meta, quantity }),
      remove: (key) => dispatch({ type: "remove", key }),
      clear: () => dispatch({ type: "clear" }),
      isOpen,
      open: () => {
        finishOnboarding();
        setSheetMounted(true);
        setOpen(true);
      },
      close: () => setOpen(false),
      hintOpen,
      dismissHint: finishOnboarding,
    };
  }, [lines, isOpen, onboarded, hintOpen]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {sheetMounted ? <CheckoutSheet /> : null}
    </CartContext.Provider>
  );
}
