"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CategoryDTO, ItemDTO, ItemsResponse } from "@/lib/validation/items";
import { Button } from "@/components/ui/button";
import { ItemCard } from "./item-card";
import { SearchFilterBar } from "./search-filter-bar";

type Status = "loading" | "ok" | "error";

/**
 * Gallery katalog publik (S1) — grid responsif 2→3→4, search debounce 250ms
 * untuk request (input responsif seketika), filter kategori, state
 * loading/empty/error. Membaca `GET /api/items`.
 */
export function CatalogGallery() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [items, setItems] = useState<ItemDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedQ = useDebounced(q, 250);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (category !== null) params.set("category", String(category));

    fetch(`/api/items?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ItemsResponse>;
      })
      .then((data) => {
        setItems(data.items);
        // Kategori hanya diperbarui dari respons tak terfilter agar chip stabil.
        if (category === null && !debouncedQ.trim()) setCategories(data.categories);
        setStatus("ok");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [debouncedQ, category, reloadKey]);

  const content = useMemo(() => {
    if (status === "loading") return <GallerySkeleton />;
    if (status === "error")
      return (
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      );
    if (items.length === 0) return <EmptyState />;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {items.map((it, i) => (
          <ItemCard key={it.id} item={it} index={i} />
        ))}
      </div>
    );
  }, [status, items]);

  return (
    <div className="flex flex-col gap-6">
      <SearchFilterBar
        q={q}
        onQ={setQ}
        category={category}
        onCategory={setCategory}
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

/** Debounce nilai untuk request (UI tetap responsif seketika). */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
