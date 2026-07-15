"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { FolderCog, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, deleteItem, fetchCategories, fetchItems } from "@/lib/admin-client";
import type { AdminItemDTO } from "@/server/catalog/admin";
import { formatNumber } from "@/lib/utils";
import { AvailabilityBadge } from "@/components/catalog/status-badge";
import { CategoryManager } from "@/components/admin/category-manager";
import { DataTable } from "@/components/admin/data-table";
import { ItemFormDialog } from "@/components/admin/item-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Admin Barang (S5, FR3/FR12) — tabel CRUD + filter + kelola kategori. */
export default function BarangPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminItemDTO | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  const itemsQ = useQuery({ queryKey: ["items"], queryFn: () => fetchItems() });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const del = useMutation({
    mutationFn: (id: number) => deleteItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Barang dihapus.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menghapus barang."),
  });

  const rows = useMemo(() => {
    const all = itemsQ.data?.items ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter(
      (it) =>
        (!needle || it.name.toLowerCase().includes(needle)) &&
        (!categoryId || String(it.categoryId) === categoryId),
    );
  }, [itemsQ.data, q, categoryId]);

  const columns = useMemo<ColumnDef<AdminItemDTO, unknown>[]>(
    () => [
      {
        id: "foto",
        header: "Foto",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.original.photoUrl}
              alt=""
              className="h-10 w-10 rounded-inline border border-hairline object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-inline bg-surface-2" aria-hidden />
          ),
      },
      { accessorKey: "name", header: "Nama", cell: ({ getValue }) => <span className="font-[600]">{String(getValue())}</span> },
      {
        accessorKey: "category",
        header: "Kategori",
        cell: ({ getValue }) => (getValue() ? String(getValue()) : <span className="text-ink-muted">—</span>),
      },
      {
        accessorKey: "stockTotal",
        header: "Stok",
        cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(Number(getValue()))}</span>,
      },
      {
        accessorKey: "available",
        header: "Tersedia",
        cell: ({ getValue }) => <AvailabilityBadge available={Number(getValue())} />,
      },
      {
        id: "aksi",
        header: "Aksi",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(row.original);
                setFormOpen(true);
              }}
              aria-label={`Ubah ${row.original.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
            >
              <Pencil size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Hapus barang "${row.original.name}"? Tindakan ini tak bisa dibatalkan.`)) {
                  del.mutate(row.original.id);
                }
              }}
              aria-label={`Hapus ${row.original.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-danger hover:bg-surface-2"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ),
      },
    ],
    [del],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-[700] tracking-[-0.374px]">Barang</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCatOpen(true)}>
            <FolderCog size={18} aria-hidden /> Kelola Kategori
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} aria-hidden /> Tambah Barang
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari barang…"
          className="max-w-xs"
          aria-label="Cari barang"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter kategori"
          className="h-11 rounded-full border border-hairline bg-surface px-4 text-[15px] text-ink"
        >
          <option value="">Semua kategori</option>
          {(catsQ.data?.categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {itemsQ.isLoading ? (
        <p className="rounded-card border border-hairline bg-surface px-4 py-10 text-center text-[14px] text-ink-muted">
          Memuat…
        </p>
      ) : itemsQ.isError ? (
        <div className="rounded-card border border-hairline bg-surface px-4 py-10 text-center">
          <p className="text-[14px] text-ink-muted">Gagal memuat barang.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => itemsQ.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-hairline bg-surface px-4 py-10 text-center text-[14px] text-ink-muted">
          Belum ada barang. Tekan “Tambah Barang”.
        </p>
      ) : (
        <DataTable columns={columns} data={rows} />
      )}

      {formOpen && (
        <ItemFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          item={editing}
          categories={catsQ.data?.categories ?? []}
        />
      )}
      <CategoryManager open={catOpen} onClose={() => setCatOpen(false)} />
    </div>
  );
}
