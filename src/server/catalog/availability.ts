/**
 * Invariant ketersediaan — sumber kebenaran TUNGGAL (SDD Data Design).
 *
 *   available(item|variant) = stock_total − Σ(quantity − quantity_returned)
 *                             untuk loans berstatus (RESERVED, ACTIVE)
 *
 * Fungsi murni; tak pernah negatif (klamp ke 0 untuk ketahanan koreksi data).
 * Ketersediaan tidak pernah dipersistensi sebagai kolom.
 */
export function computeAvailable(stockTotal: number, heldQuantity: number): number {
  return Math.max(0, stockTotal - heldQuantity);
}

/** Jumlah tertahan dari satu baris pinjam: quantity − quantity_returned. */
export function heldFromLine(quantity: number, quantityReturned: number): number {
  return Math.max(0, quantity - quantityReturned);
}
