/**
 * Logika keranjang murni (tanpa React) — dapat diuji unit. State keranjang
 * dipersistensi client (localStorage) oleh CartProvider. Kuantitas selalu
 * dibatasi `available` (mencegah oversell di UI — QuantityStepper/SDD invariant),
 * kecuali baris `bookingOnly` (barang habis yang dibooking) — dibatasi
 * `stockTotal`, karena booking belum menahan stok (divalidasi saat approve).
 */
export interface CartItemMeta {
  itemId: number;
  variantId: number | null;
  name: string;
  available: number;
  photoUrl: string | null;
  /** Barang habis yang hanya bisa dibooking → checkout dipaksa mode booking. */
  bookingOnly?: boolean;
  stockTotal?: number;
}

export interface CartLine extends CartItemMeta {
  quantity: number;
}

/** Kunci baris unik per (barang, varian). */
export function lineKey(itemId: number, variantId: number | null): string {
  return variantId != null ? `${itemId}:${variantId}` : `${itemId}`;
}

/** Batasi kuantitas ke [0, available]. */
export function clampQty(qty: number, available: number): number {
  return Math.max(0, Math.min(qty, available));
}

/** Kuantitas maksimum sebuah baris: `available`, atau `stockTotal` bila booking-only. */
export function lineMax(meta: CartItemMeta): number {
  return meta.bookingOnly ? (meta.stockTotal ?? 0) : meta.available;
}

/** Keranjang berisi barang habis → hanya bisa diajukan sebagai booking. */
export function requiresBooking(state: CartLine[]): boolean {
  return state.some((l) => l.bookingOnly === true);
}

export type CartAction =
  | { type: "increment"; meta: CartItemMeta }
  | { type: "decrement"; key: string }
  | { type: "setQuantity"; meta: CartItemMeta; quantity: number }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "hydrate"; lines: CartLine[] };

function upsert(state: CartLine[], meta: CartItemMeta, quantity: number): CartLine[] {
  const key = lineKey(meta.itemId, meta.variantId);
  const qty = clampQty(quantity, lineMax(meta));
  const rest = state.filter((l) => lineKey(l.itemId, l.variantId) !== key);
  if (qty <= 0) return rest; // qty 0 → baris dihapus
  // Pertahankan urutan: perbarui di tempat bila sudah ada, else tambah di akhir.
  const existed = state.some((l) => lineKey(l.itemId, l.variantId) === key);
  const line: CartLine = { ...meta, quantity: qty };
  if (existed) return state.map((l) => (lineKey(l.itemId, l.variantId) === key ? line : l));
  return [...rest, line];
}

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "increment": {
      const key = lineKey(action.meta.itemId, action.meta.variantId);
      const current = state.find((l) => lineKey(l.itemId, l.variantId) === key);
      return upsert(state, action.meta, current ? current.quantity + 1 : 1);
    }
    case "decrement": {
      const current = state.find((l) => lineKey(l.itemId, l.variantId) === action.key);
      if (!current) return state;
      return upsert(state, current, current.quantity - 1);
    }
    case "setQuantity":
      return upsert(state, action.meta, action.quantity);
    case "remove":
      return state.filter((l) => lineKey(l.itemId, l.variantId) !== action.key);
    case "clear":
      return [];
    case "hydrate":
      return action.lines;
    default:
      return state;
  }
}

/** Badge keranjang = jumlah baris berbeda (DSD S1 "🛒(2)"). */
export function cartCount(state: CartLine[]): number {
  return state.length;
}

/** Payload lines untuk `POST /api/loans`. */
export function cartLinesToPayload(
  state: CartLine[],
): { itemId: number; variantId?: number; quantity: number }[] {
  return state.map((l) => ({
    itemId: l.itemId,
    ...(l.variantId != null ? { variantId: l.variantId } : {}),
    quantity: l.quantity,
  }));
}
