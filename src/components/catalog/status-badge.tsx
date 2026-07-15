import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";

/**
 * StatusBadge ketersediaan — pasangan tint+teks (kontras AA) + LABEL TEKS
 * (bukan warna saja; DSD A11y). `available=0` → "Habis".
 */
export function AvailabilityBadge({ available }: { available: number }) {
  const habis = available <= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[14px] font-[600] tabular-nums",
        habis ? "bg-habis-bg text-habis-fg" : "bg-avail-bg text-avail-fg",
      )}
    >
      {habis ? "Habis" : `Tersedia ${formatNumber(available)}`}
    </span>
  );
}
