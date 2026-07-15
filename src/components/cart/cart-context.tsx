"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import {
  cartCount,
  cartReducer,
  lineKey,
  type CartItemMeta,
  type CartLine,
} from "@/lib/cart";
import { CheckoutSheet } from "./checkout-sheet";

const STORAGE_KEY = "katalog:cart:v1";

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
  const [hydrated, setHydrated] = useState(false);

  // Hydrate dari localStorage sekali di client (hindari mismatch SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", lines: JSON.parse(raw) as CartLine[] });
    } catch {
      /* localStorage tak tersedia / korup — mulai keranjang kosong. */
    }
    setHydrated(true);
  }, []);

  // Persist tiap perubahan (setelah hydrate agar tak menimpa dengan kosong).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* kuota/privasi — abaikan. */
    }
  }, [lines, hydrated]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: cartCount(lines),
      qtyOf: (itemId, variantId) => {
        const key = lineKey(itemId, variantId);
        return lines.find((l) => lineKey(l.itemId, l.variantId) === key)?.quantity ?? 0;
      },
      increment: (meta) => dispatch({ type: "increment", meta }),
      decrement: (key) => dispatch({ type: "decrement", key }),
      setQuantity: (meta, quantity) => dispatch({ type: "setQuantity", meta, quantity }),
      remove: (key) => dispatch({ type: "remove", key }),
      clear: () => dispatch({ type: "clear" }),
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    [lines, isOpen],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CheckoutSheet />
    </CartContext.Provider>
  );
}
