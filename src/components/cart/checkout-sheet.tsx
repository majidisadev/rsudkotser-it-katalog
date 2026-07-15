"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cartLinesToPayload, lineKey, type CartItemMeta } from "@/lib/cart";
import type { CreateLoanResponse } from "@/lib/validation/loans";
import { Input } from "@/components/ui/input";
import { useCart } from "./cart-context";
import { ProofCapture } from "./proof-capture";
import { QuantityStepper } from "./quantity-stepper";

const BORROWER_KEY = "katalog:borrower:v1";

/**
 * Sheet Keranjang + Checkout (DSD S2/S3, UX-001/002/003/004/011). SATU form;
 * tanggal KOSONG → peminjaman langsung (bukti wajib), TERISI → booking (tanpa
 * bukti). Radix Dialog memberi focus-trap + Escape + scroll-lock (a11y).
 */
export function CheckoutSheet() {
  const { isOpen, close, lines, increment, decrement, remove, clear } =
    useCart();

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [bookingMode, setBookingMode] = useState(false);
  const [plannedDate, setPlannedDate] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateLoanResponse | null>(null);
  // Sekali sukses, penutupan sheet me-reload agar stok katalog terupdate.
  const [needsRefresh, setNeedsRefresh] = useState(false);

  // BOOKING ditentukan toggle eksplisit (bukan sekadar tanggal terisi).
  const booking = bookingMode;

  function toggleBooking(on: boolean) {
    setBookingMode(on);
    if (on) setProofFile(null);
    else setPlannedDate("");
  }

  // Prefill nama & unit dari kunjungan lalu (UX-003), dengan penanda anti
  // salah-atribusi di perangkat bersama.
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem(BORROWER_KEY);
      if (raw) {
        const b = JSON.parse(raw) as { name?: string; unit?: string };
        if (b.name || b.unit) {
          setName(b.name ?? "");
          setUnit(b.unit ?? "");
          setPrefilled(true);
        }
      }
    } catch {
      /* abaikan */
    }
  }, [isOpen]);

  const canSubmit = useMemo(
    () =>
      lines.length > 0 &&
      name.trim().length > 0 &&
      unit.trim().length > 0 &&
      (booking ? plannedDate.trim() !== "" : proofFile !== null) &&
      !submitting,
    [lines.length, name, unit, booking, plannedDate, proofFile, submitting],
  );

  function resetForm() {
    setProofFile(null);
    setResult(null);
    setPlannedDate("");
    setBookingMode(false);
  }

  function forgetBorrower() {
    setName("");
    setUnit("");
    setPrefilled(false);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("borrowerName", name.trim());
      fd.set("borrowerUnit", unit.trim());
      if (booking) fd.set("plannedDate", plannedDate);
      fd.set("lines", JSON.stringify(cartLinesToPayload(lines)));
      if (!booking && proofFile) fd.set("proof", proofFile);

      const res = await fetch("/api/loans", { method: "POST", body: fd });
      if (res.status === 201) {
        const data = (await res.json()) as CreateLoanResponse;
        try {
          localStorage.setItem(
            BORROWER_KEY,
            JSON.stringify({ name: name.trim(), unit: unit.trim() }),
          );
        } catch {
          /* abaikan */
        }
        clear();
        setResult(data);
        setNeedsRefresh(true);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (res.status === 409) {
        toast.error(
          body?.error?.message ?? "Stok baru saja berubah. Periksa keranjang.",
        );
      } else if (res.status === 429) {
        toast.error("Terlalu banyak permintaan. Coba lagi sebentar, ya.");
      } else {
        toast.error(
          body?.error?.message ?? "Gagal memproses peminjaman. Coba lagi.",
        );
      }
    } catch {
      toast.error("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(o) => {
        if (o) return;
        // Setelah peminjaman sukses, reload agar stok katalog terupdate.
        if (needsRefresh) {
          window.location.reload();
          return;
        }
        close();
        resetForm();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="checkout-overlay fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="checkout-sheet fixed inset-x-0 bottom-0 z-40 flex max-h-[92dvh] flex-col rounded-t-[20px] border border-hairline bg-surface shadow-[var(--shadow-float)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-[20px]"
        >
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <Dialog.Title className="text-[21px] font-[600] text-ink">
              {result ? "Selesai" : "Keranjang"}
            </Dialog.Title>
            <Dialog.Close
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
              aria-label="Tutup"
            >
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>

          {result ? (
            <SuccessView result={result} onDone={() => window.location.reload()} />
          ) : lines.length === 0 ? (
            <EmptyCart />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Daftar keranjang */}
                <ul className="flex flex-col gap-3">
                  {lines.map((l) => {
                    const meta: CartItemMeta = {
                      itemId: l.itemId,
                      variantId: l.variantId,
                      name: l.name,
                      available: l.available,
                      photoUrl: l.photoUrl,
                    };
                    return (
                      <li
                        key={lineKey(l.itemId, l.variantId)}
                        className="flex items-center gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-[600] text-ink">
                            {l.name}
                          </p>
                        </div>
                        <QuantityStepper
                          quantity={l.quantity}
                          max={l.available}
                          onIncrement={() => increment(meta)}
                          onDecrement={() =>
                            decrement(lineKey(l.itemId, l.variantId))
                          }
                          label={l.name}
                        />
                        <button
                          type="button"
                          onClick={() => remove(lineKey(l.itemId, l.variantId))}
                          aria-label={`Hapus ${l.name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-danger"
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Form peminjam */}
                <div className="mt-6 flex flex-col gap-3">
                  <Field label="Nama" htmlFor="borrower-name">
                    <Input
                      id="borrower-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Anda"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Unit / Ruangan" htmlFor="borrower-unit">
                    <Input
                      id="borrower-unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="mis. IGD"
                      autoComplete="off"
                    />
                  </Field>
                  {prefilled ? (
                    <button
                      type="button"
                      onClick={forgetBorrower}
                      className="self-start text-[13px] font-[600] text-primary"
                    >
                      Bukan Anda? Ganti
                    </button>
                  ) : null}

                  {/* Toggle booking — tanggal pakai muncul hanya bila aktif */}
                  <div className="flex items-center justify-between gap-3 rounded-inline bg-surface-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[14px] font-[600] text-ink">Jadwalkan (booking)</p>
                      <p className="text-[12px] text-ink-muted">
                        Untuk dipakai di tanggal mendatang.
                      </p>
                    </div>
                    <Toggle
                      checked={bookingMode}
                      onCheckedChange={toggleBooking}
                      label="Jadwalkan peminjaman (booking)"
                    />
                  </div>

                  {booking ? (
                    <Field label="Tanggal pakai" htmlFor="planned-date">
                      <Input
                        id="planned-date"
                        type="date"
                        value={plannedDate}
                        onChange={(e) => setPlannedDate(e.target.value)}
                      />
                    </Field>
                  ) : null}

                  {/* Bukti (DIRECT) vs hint booking — cross-fade */}
                  {booking ? (
                    <p className="rounded-inline bg-surface-2 px-3 py-3 text-[14px] text-ink-muted">
                      Booking aktif setelah disetujui admin. Bukti diambil saat
                      barang diserahkan.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-[600] text-ink">
                        Bukti serah-terima
                      </span>
                      <ProofCapture onChange={setProofFile} />
                    </div>
                  )}
                </div>
              </div>

              {/* Aksi (sticky) */}
              <div className="border-t border-hairline bg-surface/80 px-5 py-4 backdrop-blur-xl [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={submit}
                  className="w-full rounded-full bg-primary px-5 py-3 text-[17px] font-[600] text-primary-fg transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)] active:scale-[0.98] hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
                >
                  {submitting ? "Memproses…" : "Pinjam"}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-[14px] font-[600] text-ink">{label}</span>
      {children}
    </label>
  );
}

/** Switch aksesibel (role=switch, keyboard) — aksen tunggal Action Blue. */
function Toggle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-hairline transition-colors duration-[var(--dur-base)] ${
        checked ? "bg-primary" : "bg-ink-muted/40"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-[17px] font-[600] text-ink">Keranjang masih kosong.</p>
      <p className="text-[15px] text-ink-muted">
        Pilih barang dari katalog untuk mulai meminjam.
      </p>
    </div>
  );
}

function SuccessView({
  result,
  onDone,
}: {
  result: CreateLoanResponse;
  onDone: () => void;
}) {
  const booking = result.type === "BOOKING";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-avail-bg text-avail-fg">
        <Check size={32} aria-hidden />
      </div>
      <div>
        <p className="text-[19px] font-[600] text-ink">
          {booking ? "Booking terkirim" : "Peminjaman berhasil dicatat"}
        </p>
        <p className="mt-1 text-[15px] text-ink-muted text-pretty">
          {booking
            ? "Menunggu persetujuan admin. Konfirmasi status langsung ke admin unit IT (tidak ada notifikasi otomatis)."
            : "Barang tercatat sedang dipinjam. Terima kasih."}
        </p>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="rounded-full bg-primary px-5 py-2.5 text-[15px] font-[600] text-primary-fg active:scale-[0.96] hover:bg-primary-hover"
      >
        Selesai
      </button>
    </div>
  );
}
