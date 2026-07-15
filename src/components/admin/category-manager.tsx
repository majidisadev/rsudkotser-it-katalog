"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ApiError,
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "./modal";

/**
 * Kelola kategori (UX-012, S5) — CRUD sederhana; kategori boleh kosong di awal.
 * Menghapus kategori menolkan kategori barang (SET NULL, tak menghalangi).
 */
export function CategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["items"] });
  };
  const onError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : "Gagal memproses kategori.");

  const create = useMutation({
    mutationFn: () => createCategory(newName.trim()),
    onSuccess: () => {
      setNewName("");
      invalidate();
    },
    onError,
  });
  const rename = useMutation({
    mutationFn: () => updateCategory(editId!, editName.trim()),
    onSuccess: () => {
      setEditId(null);
      invalidate();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: invalidate,
    onError,
  });

  const categories = data?.categories ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Kelola Kategori">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim() && !create.isPending) create.mutate();
        }}
        className="mb-4 flex gap-2"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nama kategori baru"
          aria-label="Nama kategori baru"
        />
        <Button type="submit" size="sm" disabled={!newName.trim() || create.isPending}>
          Tambah
        </Button>
      </form>

      {categories.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-muted">Belum ada kategori.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2.5">
              {editId === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Ubah nama kategori"
                    className="h-9"
                  />
                  <button
                    type="button"
                    onClick={() => editName.trim() && rename.mutate()}
                    aria-label="Simpan"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-surface-2"
                  >
                    <Check size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    aria-label="Batal"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[15px]">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                    }}
                    aria-label={`Ubah ${c.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Hapus kategori "${c.name}"? Barang terkait jadi tanpa kategori.`)) {
                        remove.mutate(c.id);
                      }
                    }}
                    aria-label={`Hapus ${c.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-danger hover:bg-surface-2"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
