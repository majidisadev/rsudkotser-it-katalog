"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/**
 * Modal admin (DSD Dialog) — Radix Dialog: focus-trap, Escape, scrim dim,
 * `--shadow-float`. Dipakai untuk form barang, kelola kategori, detail
 * peminjaman, konfirmasi.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-[overlay-in_200ms_ease-out]" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-40 w-[calc(100vw-2rem)] ${
            wide ? "max-w-2xl" : "max-w-md"
          } max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-hairline bg-surface p-5 shadow-[var(--shadow-float)] data-[state=open]:animate-[modal-in_200ms_var(--ease-out)]`}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-[21px] font-[600] tracking-[-0.374px]">{title}</Dialog.Title>
            <Dialog.Close
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
              aria-label="Tutup"
            >
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
