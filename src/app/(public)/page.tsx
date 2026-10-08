import { LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CatalogGallery } from "@/components/catalog/catalog-gallery";
import { CartButton } from "@/components/cart/cart-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { listItems } from "@/server/catalog/service";

// Ketersediaan stok harus segar tiap kunjungan → render per-request.
export const dynamic = "force-dynamic";

/**
 * Katalog publik (S1) — mobile-first. Top bar frosted + toggle tema + keranjang.
 * Alur checkout (S2) lewat CartProvider/CheckoutSheet (layout publik).
 * Data katalog di-render di server: kartu & foto sudah ada di HTML awal → LCP
 * tak menunggu JS + fetch client. Sengaja TANPA Suspense/streaming: konten yang
 * di-stream baru dipasang ke DOM oleh script React (menunda paint LCP).
 */
export default async function CatalogPage() {
  const initial = await loadCatalog();

  return (
    <div className="min-h-dvh">
      <a
        href="#katalog"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-full focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-[14px] focus-visible:font-[600] focus-visible:text-primary-fg"
      >
        Lewati ke katalog
      </a>
      <header className="sticky top-0 z-10 border-b border-hairline bg-surface-parchment/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2.5 text-[21px] font-[600] tracking-tight text-ink">
            <Image
              src="/logo.png"
              alt=""
              width={30}
              height={32}
              priority
              className="h-8 w-auto"
            />
            Katalog IT RSUD
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <CartButton />
            <Link
              href="/admin/login"
              prefetch={false}
              aria-label="Login admin"
              title="Login admin"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform hover:bg-surface-2 active:scale-[0.96]"
            >
              <LogIn size={20} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main id="katalog" className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-1 text-[28px] font-[600] tracking-tight text-ink text-balance">
          Barang unit IT
        </h1>
        <p className="mb-6 text-[17px] text-ink-muted text-pretty">
          Cari barang yang tersedia untuk dipinjam.
        </p>
        <CatalogGallery initial={initial} />
      </main>
    </div>
  );
}

async function loadCatalog() {
  try {
    return await listItems(db, {});
  } catch (err) {
    // DB gagal saat SSR → biarkan client mencoba lewat /api/items (state error + retry).
    logger.error({ err }, "SSR katalog gagal");
    return null;
  }
}
