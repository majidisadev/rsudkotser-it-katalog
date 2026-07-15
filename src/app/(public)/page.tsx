import { LogIn } from "lucide-react";
import Link from "next/link";
import { CatalogGallery } from "@/components/catalog/catalog-gallery";
import { CartButton } from "@/components/cart/cart-button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Katalog publik (S1) — mobile-first. Top bar frosted + toggle tema + keranjang.
 * Alur checkout (S2) lewat CartProvider/CheckoutSheet (layout publik).
 */
export default function CatalogPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-hairline bg-surface-parchment/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-[21px] font-[600] tracking-tight text-ink">Katalog IT RSUD</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <CartButton />
            <Link
              href="/admin/login"
              aria-label="Login admin"
              title="Login admin"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform hover:bg-surface-2 active:scale-[0.96]"
            >
              <LogIn size={20} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-1 text-[28px] font-[600] tracking-tight text-ink text-balance">
          Barang unit IT
        </h1>
        <p className="mb-6 text-[17px] text-ink-muted text-pretty">
          Cari barang yang tersedia untuk dipinjam.
        </p>
        <CatalogGallery />
      </main>
    </div>
  );
}
