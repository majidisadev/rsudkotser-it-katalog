"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CategoryDTO, ItemDTO, ItemsResponse } from "@/lib/validation/items";
import { filterItems } from "@/lib/catalog-filter";
import { Button } from "@/components/ui/button";
import { ItemCard } from "./item-card";
import { SearchFilterBar } from "./search-filter-bar";

type Status = "loading" | "ok" | "error";

/**
 * Gallery katalog publik (S1) — grid responsif 2→3→4, state
 * loading/empty/error. Seluruh katalog dimuat SEKALI (dari SSR `initial`, atau
 * `GET /api/items` bila SSR gagal/retry), lalu pencarian & filter kategori
 * disaring di client → ganti kategori instan tanpa request/skeleton ulang.
 * Kata kunci di-defer agar ketikan tetap responsif.
 */
export function CatalogGallery({ initial }: { initial: ItemsResponse | null }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [items, setItems] = useState<ItemDTO[]>(initial?.items ?? []);
  const [categories, setCategories] = useState<CategoryDTO[]>(initial?.categories ?? []);
  const [status, setStatus] = useState<Status>(initial ? "ok" : "loading");
  // 0 = pakai data SSR (tanpa fetch); ≥1 = fetch dari API (tanpa data awal / retry).
  const [reloadKey, setReloadKey] = useState(initial ? 0 : 1);
  // Kartu hasil SSR tampil tanpa animasi masuk (tak menunda LCP); animasi hanya
  // untuk kartu yang muncul setelah pengguna mengubah filter.
  const [animateCards, setAnimateCards] = useState(!initial);

  const deferredQ = useDeferredValue(q);

  useEffect(() => {
    if (reloadKey === 0) return;
    const controller = new AbortController();
    setStatus("loading");

    fetch("/api/items", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ItemsResponse>;
      })
      .then((data) => {
        setItems(data.items);
        setCategories(data.categories);
        setStatus("ok");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [reloadKey]);

  const visible = useMemo(
    () => filterItems(items, deferredQ, category),
    [items, deferredQ, category],
  );

  const content = useMemo(() => {
    if (status === "loading") return <GallerySkeleton />;
    if (status === "error")
      return (
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      );
    if (visible.length === 0) return <EmptyState />;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {visible.map((it, i) => (
          <ItemCard key={it.id} item={it} index={i} animate={animateCards} />
        ))}
      </div>
    );
  }, [status, visible, animateCards]);

  return (
    <div className="flex flex-col gap-6">
      <SearchFilterBar
        q={q}
        onQ={(v) => {
          setAnimateCards(true);
          setQ(v);
        }}
        category={category}
        onCategory={(v) => {
          setAnimateCards(true);
          setCategory(v);
        }}
        categories={categories}
      />
      {content}
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
    >
      <span className="sr-only">Memuat katalog…</span>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-card border border-hairline bg-surface p-4 sm:p-6"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="mb-4 aspect-[4/3] rounded-inline bg-surface-2" />
          <div className="mb-2 h-3 w-1/3 rounded bg-surface-2" />
          <div className="mb-3 h-4 w-2/3 rounded bg-surface-2" />
          <div className="h-6 w-24 rounded-full bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-hairline bg-surface px-6 py-16 text-center">
      <p className="text-[17px] font-[600] text-ink">Belum ada barang tersedia.</p>
      <p className="text-[15px] text-ink-muted">
        Coba ubah kata kunci pencarian atau pilih kategori lain.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-hairline bg-surface px-6 py-16 text-center">
      <div>
        <p className="text-[17px] font-[600] text-ink">Gagal memuat katalog.</p>
        <p className="text-[15px] text-ink-muted">Periksa koneksi lalu coba lagi.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Coba lagi
      </Button>
    </div>
  );
}
