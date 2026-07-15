"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ApiError,
  activateLoan,
  deleteProof,
  fetchLoanDetail,
  patchLine,
  returnLine,
  undoReturn,
} from "@/lib/admin-client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ProofCapture } from "@/components/cart/proof-capture";
import { Button } from "@/components/ui/button";
import { LoanStatusBadge } from "./loan-status-badge";
import { Modal } from "./modal";

/**
 * Detail peminjaman (S6) — modal dengan aksi per-status: koreksi jumlah (PENDING,
 * F3), tandai Diambil + bukti PICKUP (RESERVED, UX-011), pengembalian sebagian
 * + undo (ACTIVE, F4), hapus bukti. Menyegarkan query setelah tiap aksi.
 */
export function LoanDetailDialog({ loanId, onClose }: { loanId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => fetchLoanDetail(loanId),
  });
  const loan = data?.loan;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["loan", loanId] });
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const onError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : "Gagal memproses aksi.");

  const [proof, setProof] = useState<File | null>(null);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});

  const activate = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set("proof", proof!);
      return activateLoan(loanId, form);
    },
    onSuccess: () => {
      setProof(null);
      invalidate();
      toast.success("Barang ditandai diambil.");
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: number; quantity: number }) =>
      patchLine(loanId, lineId, quantity),
    onSuccess: () => {
      invalidate();
      toast.success("Jumlah diperbarui.");
    },
    onError,
  });

  const doReturn = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: number; quantity: number }) =>
      returnLine(loanId, lineId, quantity),
    onSuccess: (_res, vars) => {
      invalidate();
      toast.success("Pengembalian dicatat.", {
        duration: 5000,
        action: {
          label: "Urungkan",
          onClick: () =>
            undoReturn(loanId, vars.lineId, vars.quantity)
              .then(() => {
                invalidate();
                toast.success("Pengembalian diurungkan.");
              })
              .catch(onError),
        },
      });
    },
    onError,
  });

  const removeProof = useMutation({
    mutationFn: (proofId: number) => deleteProof(proofId),
    onSuccess: () => {
      invalidate();
      toast.success("Bukti dihapus.");
    },
    onError,
  });

  return (
    <Modal open onClose={onClose} title="Detail Peminjaman" wide>
      {isLoading || !loan ? (
        <p className="py-8 text-center text-[14px] text-ink-muted">Memuat…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
            <span className="font-[600]">{loan.borrowerName}</span>
            <span className="text-ink-muted">· {loan.borrowerUnit} ·</span>
            <span>{loan.type === "BOOKING" ? "Booking" : "Langsung"}</span>
            <LoanStatusBadge status={loan.status} />
          </div>
          <div className="text-[13px] text-ink-muted">
            Dibuat {formatDateTime(loan.createdAt)}
            {loan.plannedDate ? ` · Rencana pakai ${formatDate(loan.plannedDate)}` : ""}
            {loan.returnedAt ? ` · Dikembalikan ${formatDateTime(loan.returnedAt)}` : ""}
          </div>

          {/* Baris barang */}
          <div>
            <h3 className="mb-2 text-[15px] font-[600]">Barang</h3>
            <ul className="divide-y divide-hairline rounded-pearl border border-hairline">
              {loan.lines.map((line) => {
                const remaining = line.quantity - line.quantityReturned;
                return (
                  <li key={line.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-[600]">
                        {line.itemName}
                        {line.variantName ? ` — ${line.variantName}` : ""}
                      </div>
                      <div className="text-[13px] tabular-nums text-ink-muted">
                        pinjam {line.quantity} · kembali {line.quantityReturned}
                      </div>
                    </div>

                    {loan.status === "PENDING" && (
                      <PendingQtyEditor
                        defaultValue={line.quantity}
                        disabled={patch.isPending}
                        onSave={(quantity) => patch.mutate({ lineId: line.id, quantity })}
                      />
                    )}

                    {loan.status === "ACTIVE" && remaining > 0 && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={remaining}
                          value={returnQty[line.id] ?? remaining}
                          onChange={(e) =>
                            setReturnQty((m) => ({ ...m, [line.id]: Number(e.target.value) }))
                          }
                          aria-label={`Jumlah kembali ${line.itemName}`}
                          className="h-9 w-16 rounded-full border border-hairline bg-surface px-3 text-center text-[14px] tabular-nums"
                        />
                        <Button
                          size="sm"
                          disabled={doReturn.isPending}
                          onClick={() =>
                            doReturn.mutate({
                              lineId: line.id,
                              quantity: returnQty[line.id] ?? remaining,
                            })
                          }
                        >
                          Kembalikan
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Tandai Diambil (RESERVED) — bukti PICKUP wajib */}
          {loan.status === "RESERVED" && (
            <div>
              <h3 className="mb-2 text-[15px] font-[600]">Serah-terima (Diambil)</h3>
              <p className="mb-2 text-[13px] text-ink-muted">
                Rekam bukti serah-terima — foto atau tanda tangan — lalu tandai barang Diambil.
              </p>
              <ProofCapture onChange={setProof} />
              <Button
                className="mt-3 w-full"
                disabled={!proof || activate.isPending}
                onClick={() => activate.mutate()}
              >
                {activate.isPending ? "Memproses…" : "Tandai Diambil"}
              </Button>
            </div>
          )}

          {/* Bukti tersimpan */}
          <div>
            <h3 className="mb-2 text-[15px] font-[600]">Bukti</h3>
            {loan.proofs.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                {loan.type === "BOOKING" && loan.status === "PENDING"
                  ? "Booking belum diambil — bukti direkam saat “Diambil”."
                  : "Belum ada bukti."}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {loan.proofs.map((p) => (
                  <li key={p.id} className="flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Bukti ${p.kind}`}
                      className="h-24 w-24 rounded-inline border border-hairline object-cover"
                    />
                    <span className="text-[11px] text-ink-muted">{p.kind}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Hapus bukti ini? Berkas akan dihapus permanen.")) {
                          removeProof.mutate(p.id);
                        }
                      }}
                      aria-label="Hapus bukti"
                      className="inline-flex items-center gap-1 text-[12px] font-[600] text-danger"
                    >
                      <Trash2 size={13} aria-hidden /> Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function PendingQtyEditor({
  defaultValue,
  disabled,
  onSave,
}: {
  defaultValue: number;
  disabled: boolean;
  onSave: (quantity: number) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label="Koreksi jumlah"
        className="h-9 w-16 rounded-full border border-hairline bg-surface px-3 text-center text-[14px] tabular-nums"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || value < 1 || value === defaultValue}
        onClick={() => onSave(value)}
      >
        Simpan
      </Button>
    </div>
  );
}
