"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ApiError,
  type CategoryRow,
  createItem,
  updateItem,
} from "@/lib/admin-client";
import type { AdminItemDTO } from "@/server/catalog/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "./modal";

/**
 * Form tambah/ubah barang (S5, FR3) — nama, kategori, stok, deskripsi, foto.
 * Foto diproses server (re-encode WebP + buang EXIF). Validasi inline; submit
 * mencegah double-submit.
 */
export function ItemFormDialog({
  open,
  onClose,
  item,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  item?: AdminItemDTO | null;
  categories: CategoryRow[];
}) {
  const editing = !!item;
  const qc = useQueryClient();

  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ? String(item.categoryId) : "");
  const [stock, setStock] = useState<string>(item ? String(item.stockTotal) : "0");
  const [description, setDescription] = useState(item?.description ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(item?.photoUrl ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.set("name", name);
      form.set("stockTotal", stock);
      if (categoryId) form.set("categoryId", categoryId);
      if (description) form.set("description", description);
      if (photoFile) form.set("photo", photoFile);
      else if (editing && removePhoto) form.set("removePhoto", "true");
      return editing ? updateItem(item!.id, form) : createItem(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Barang diperbarui." : "Barang ditambahkan.");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan barang."),
  });

  const onPhoto = (file: File | null) => {
    setPhotoFile(file);
    setRemovePhoto(false);
    setPreview(file ? URL.createObjectURL(file) : editing ? (item?.photoUrl ?? null) : null);
  };

  const nameInvalid = name.trim().length === 0;

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Ubah Barang" : "Tambah Barang"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nameInvalid && !mutation.isPending) mutation.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Nama barang" htmlFor="item-name">
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={nameInvalid ? true : undefined}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stok total" htmlFor="item-stock">
            <Input
              id="item-stock"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Kategori" htmlFor="item-category">
            <select
              id="item-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-11 w-full rounded-full border border-hairline bg-surface px-4 text-[15px] text-ink focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            >
              <option value="">— Tanpa kategori —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Deskripsi (opsional)" htmlFor="item-desc">
          <textarea
            id="item-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-pearl border border-hairline bg-surface px-4 py-2.5 text-[15px] text-ink focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          />
        </Field>

        <Field label="Foto (opsional)" htmlFor="item-photo">
          <div className="flex items-center gap-3">
            {preview && !removePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Pratinjau foto barang"
                className="h-16 w-16 rounded-inline border border-hairline object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-inline border border-dashed border-hairline text-[11px] text-ink-muted">
                Tanpa foto
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <input
                id="item-photo"
                type="file"
                accept="image/*"
                onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                className="text-[13px] text-ink-muted file:mr-2 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[13px] file:font-[600] file:text-ink"
              />
              {editing && (preview || item?.photoUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPreview(null);
                    setRemovePhoto(true);
                  }}
                  className="self-start text-[13px] font-[600] text-danger"
                >
                  Hapus foto
                </button>
              )}
            </div>
          </div>
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" size="sm" disabled={nameInvalid || mutation.isPending}>
            {mutation.isPending ? "Menyimpan…" : editing ? "Simpan" : "Tambah Barang"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-[600]">
        {label}
      </label>
      {children}
    </div>
  );
}
