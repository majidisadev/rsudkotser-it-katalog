import { expect, test } from "@playwright/test";
import { adminLogin, createItem, drawSignature, publicAvailable } from "./helpers";

/**
 * Flow 1 (SDD Testing) — checkout **langsung** publik: peminjam menambah barang,
 * mengisi identitas, memberi bukti (tanda tangan), lalu "Pinjam". Stok berkurang
 * seketika (DIRECT → ACTIVE). Membuktikan invariant stok end-to-end di browser.
 */
test("Flow 1 — checkout langsung mengurangi stok", async ({ page, request }) => {
  await adminLogin(request);
  const name = `E2E Langsung ${Date.now()}`;
  await createItem(request, name, 3);
  expect(await publicAvailable(request, name)).toBe(3);

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Cari barang" }).fill(name);

  const card = page.locator("article", { hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Tambah" }).click();

  await page.getByRole("button", { name: /Buka keranjang/ }).click();
  await page.getByLabel("Nama").fill("Petugas E2E");
  await page.getByLabel("Unit / Ruangan").fill("IGD");

  // Bukti serah-terima via tanda tangan (kamera tak tersedia di headless).
  await page.getByRole("tab", { name: "Tanda tangan" }).click();
  await drawSignature(page);

  const pinjam = page.getByRole("button", { name: "Pinjam" });
  await expect(pinjam).toBeEnabled();
  await pinjam.click();

  await expect(page.getByText("Peminjaman berhasil dicatat")).toBeVisible();
  expect(await publicAvailable(request, name)).toBe(2);
});
