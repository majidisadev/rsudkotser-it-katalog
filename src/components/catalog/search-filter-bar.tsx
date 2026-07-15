"use client";

import { Search } from "lucide-react";
import type { CategoryDTO } from "@/lib/validation/items";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  q: string;
  onQ: (v: string) => void;
  category: number | null;
  onCategory: (v: number | null) => void;
  categories: CategoryDTO[];
}

/** Toolbar cari + filter kategori (DSD S1). Input responsif seketika. */
export function SearchFilterBar({ q, onQ, category, onCategory, categories }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Cari barang…"
          aria-label="Cari barang"
          className="pl-11"
        />
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
          <CategoryChip active={category === null} onClick={() => onCategory(null)}>
            Semua
          </CategoryChip>
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              onClick={() => onCategory(c.id)}
            >
              {c.name}
            </CategoryChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-[14px] font-[600] transition-transform active:scale-[0.96]",
        active
          ? "border-primary bg-primary text-primary-fg"
          : "border-hairline bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
