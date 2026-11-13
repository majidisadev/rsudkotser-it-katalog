// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartButton } from "@/components/cart/cart-button";
import { CartProvider, useCart } from "@/components/cart/cart-context";
import type { CartItemMeta } from "@/lib/cart";

// Sheet checkout (Radix, kamera) tak relevan untuk onboarding.
vi.mock("@/components/cart/checkout-sheet", () => ({ CheckoutSheet: () => null }));

const ONBOARDING_KEY = "katalog:onboarding:cart:v1";
const meta: CartItemMeta = {
  itemId: 1,
  variantId: null,
  name: "Laptop",
  available: 5,
  photoUrl: null,
};

function AddButton() {
  const { increment } = useCart();
  return (
    <button type="button" onClick={() => increment(meta)}>
      Tambah
    </button>
  );
}

async function renderCart() {
  render(
    <CartProvider>
      <CartButton />
      <AddButton />
    </CartProvider>,
  );
  // Biarkan effect hydrate (baca localStorage) selesai.
  await act(async () => {});
}

const hint = () => screen.queryByText("Barang masuk keranjang");

describe("Onboarding tombol keranjang", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("tidak tampil sebelum ada barang ditambah", async () => {
    await renderCart();
    expect(hint()).toBeNull();
  });

  it("tampil saat barang pertama ditambah, lalu hilang permanen setelah 'Mengerti'", async () => {
    await renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    expect(hint()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mengerti" }));
    expect(hint()).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    expect(hint()).toBeNull();
  });

  it("selesai saat keranjang dibuka dari petunjuk", async () => {
    await renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat keranjang" }));
    expect(hint()).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("1");
  });

  it("bisa ditutup dengan Escape", async () => {
    await renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(hint()).toBeNull();
  });

  it("tidak tampil lagi bila pengguna sudah pernah menyelesaikannya", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    await renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    expect(hint()).toBeNull();
  });
});
