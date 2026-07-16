import { Package } from "lucide-react";
import type { ItemDTO } from "@/lib/validation/items";
import { AddToCart } from "@/components/cart/add-to-cart";
import { AvailabilityBadge } from "./status-badge";

/**
 * ItemCard (publik, adaptasi store-utility-card) — surface + hairline,
 * rounded-card(18), TANPA shadow kartu. Gambar diberi hairline inset (definisi
 * tepi untuk foto terang di atas surface terang). Nama body-strong. Kontrol
 * tambah-ke-keranjang (S2). `index` → stagger masuk halus (reduced-motion aman).
 */
export function ItemCard({ item, index = 0 }: { item: ItemDTO; index?: number }) {
  return (
    <article
      className="flex animate-[card-in_260ms_var(--ease-out)_both] flex-col rounded-card border border-hairline bg-surface p-4 sm:p-6"
      style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
    >
      <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-inline bg-surface-2 after:pointer-events-none after:absolute after:inset-0 after:rounded-inline after:shadow-[inset_0_0_0_1px_var(--hairline)]">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-muted">
            <Package size={32} aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {item.category ? (
          <span className="text-[12px] font-[600] uppercase tracking-wide text-ink-muted">
            {item.category}
          </span>
        ) : null}
        <h3 className="text-[17px] font-[600] leading-tight text-ink text-balance">{item.name}</h3>
        <div className="mt-auto flex flex-col gap-3 pt-2">
          <AvailabilityBadge available={item.available} />
          <AddToCart item={item} />
        </div>
      </div>
    </article>
  );
}
