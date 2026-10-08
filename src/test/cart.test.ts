import { describe, expect, it } from "vitest";
import {
  cartCount,
  cartLinesToPayload,
  cartReducer,
  clampQty,
  lineKey,
  lineMax,
  requiresBooking,
  type CartItemMeta,
  type CartLine,
} from "@/lib/cart";

/** Logika keranjang (S2.4) — clamp kuantitas ≤ available, badge, payload. */
const proj: CartItemMeta = {
  itemId: 1,
  variantId: null,
  name: "Proyektor",
  available: 2,
  photoUrl: null,
};
const hdmi: CartItemMeta = { itemId: 2, variantId: null, name: "Kabel HDMI", available: 5, photoUrl: null };

describe("cart logic (S2.4)", () => {
  it("increment menambah baris (qty 1) lalu naik", () => {
    let s: CartLine[] = [];
    s = cartReducer(s, { type: "increment", meta: proj });
    expect(s).toHaveLength(1);
    expect(s[0].quantity).toBe(1);
    s = cartReducer(s, { type: "increment", meta: proj });
    expect(s[0].quantity).toBe(2);
  });

  it("increment tak pernah melebihi available (cegah oversell di UI)", () => {
    let s = cartReducer([], { type: "increment", meta: proj }); // 1
    s = cartReducer(s, { type: "increment", meta: proj }); // 2 (=available)
    s = cartReducer(s, { type: "increment", meta: proj }); // tetap 2
    expect(s[0].quantity).toBe(2);
  });

  it("decrement ke 0 menghapus baris", () => {
    let s = cartReducer([], { type: "increment", meta: proj });
    s = cartReducer(s, { type: "decrement", key: lineKey(1, null) });
    expect(s).toHaveLength(0);
  });

  it("setQuantity di-clamp & qty 0 menghapus", () => {
    let s = cartReducer([], { type: "setQuantity", meta: proj, quantity: 99 });
    expect(s[0].quantity).toBe(2); // clamp ke available
    s = cartReducer(s, { type: "setQuantity", meta: proj, quantity: 0 });
    expect(s).toHaveLength(0);
  });

  it("badge = jumlah baris berbeda; payload menyertakan variantId hanya bila ada", () => {
    let s = cartReducer([], { type: "increment", meta: proj });
    s = cartReducer(s, { type: "increment", meta: hdmi });
    expect(cartCount(s)).toBe(2);
    const payload = cartLinesToPayload(s);
    expect(payload).toEqual([
      { itemId: 1, quantity: 1 },
      { itemId: 2, quantity: 1 },
    ]);
  });

  it("clampQty membatasi ke [0, available]", () => {
    expect(clampQty(-3, 5)).toBe(0);
    expect(clampQty(9, 5)).toBe(5);
    expect(clampQty(3, 5)).toBe(3);
  });

  it("clear & hydrate", () => {
    let s = cartReducer([], { type: "increment", meta: proj });
    s = cartReducer(s, { type: "clear" });
    expect(s).toHaveLength(0);
    s = cartReducer(s, { type: "hydrate", lines: [{ ...hdmi, quantity: 3 }] });
    expect(s[0].quantity).toBe(3);
  });
});

/** Barang habis tetap bisa dibooking — baris booking-only memaksa mode booking. */
describe("cart booking-only (barang habis)", () => {
  const habis: CartItemMeta = {
    itemId: 3,
    variantId: null,
    name: "Laptop",
    available: 0,
    photoUrl: null,
    bookingOnly: true,
    stockTotal: 2,
  };

  it("barang habis masuk keranjang; kuantitas dibatasi stockTotal", () => {
    let s = cartReducer([], { type: "increment", meta: habis });
    expect(s).toHaveLength(1);
    expect(lineMax(habis)).toBe(2);
    s = cartReducer(s, { type: "increment", meta: habis });
    s = cartReducer(s, { type: "increment", meta: habis });
    expect(s[0].quantity).toBe(2);
  });

  it("requiresBooking hanya bila ada baris booking-only", () => {
    let s = cartReducer([], { type: "increment", meta: proj });
    expect(requiresBooking(s)).toBe(false);
    s = cartReducer(s, { type: "increment", meta: habis });
    expect(requiresBooking(s)).toBe(true);
    s = cartReducer(s, { type: "remove", key: lineKey(3, null) });
    expect(requiresBooking(s)).toBe(false);
  });

  it("decrement mempertahankan sifat booking-only (tak terhapus karena available 0)", () => {
    let s = cartReducer([], { type: "setQuantity", meta: habis, quantity: 2 });
    s = cartReducer(s, { type: "decrement", key: lineKey(3, null) });
    expect(s[0]).toMatchObject({ quantity: 1, bookingOnly: true });
  });
});
