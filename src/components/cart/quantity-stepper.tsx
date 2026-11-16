"use client";

import { Minus, Plus } from "lucide-react";
import { formatNumber } from "@/lib/utils";

/**
 * QuantityStepper — `− [n] +`, `n` tabular-nums. Tombol `+` nonaktif saat
 * mencapai `available` (cegah oversell di UI — DSD/SDD invariant). Hit area
 * ≥ 40×40 (a11y).
 */
export function QuantityStepper({
  quantity,
  max,
  onIncrement,
  onDecrement,
  label,
}: {
  quantity: number;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
  label: string;
}) {
  return (
    // Tepi lewat ring inset (tak menambah tinggi): 2px + tombol 40px + 2px = 44px,
    // sama dengan tombol "Tambah" yang digantikannya.
    <div className="inline-flex h-11 items-center gap-1 rounded-full bg-surface p-0.5 ring-1 ring-inset ring-hairline">
      <StepButton onClick={onDecrement} disabled={quantity <= 0} aria-label={`Kurangi ${label}`}>
        <Minus size={16} aria-hidden />
      </StepButton>
      <span
        className="min-w-8 text-center text-[15px] font-[600] tabular-nums text-ink"
        aria-live="polite"
        aria-label={`${quantity} ${label}`}
      >
        {formatNumber(quantity)}
      </span>
      <StepButton
        onClick={onIncrement}
        disabled={quantity >= max}
        aria-label={`Tambah ${label}`}
      >
        <Plus size={16} aria-hidden />
      </StepButton>
    </div>
  );
}

function StepButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="press flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}
