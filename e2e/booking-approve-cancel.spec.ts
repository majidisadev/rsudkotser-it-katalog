import { expect, test } from "@playwright/test";
import { adminLogin, createItem, publicAvailable } from "./helpers";

/**
 * Flow 2 (SDD Testing) — booking publik → **approve** admin (stok ditahan) →
 * **cancel** admin (stok kembali). Booking (BOOKING → PENDING) tak menahan stok
 * sampai disetujui. Menggunakan filter barang admin (S4.2) untuk menemukan loan.
 */
test("Flow 2 — booking → approve → cancel mengembalikan stok", async ({ page, request }) => {
  await adminLogin(request);
  const name = `E2E Booking ${Date.now()}`;
  const itemId = await createItem(request, name, 2);
  expect(await publicAvailable(request, name)).toBe(2);

  // ── Booking via UI publik (toggle "Jadwalkan", tanpa bukti) ──
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Cari barang" }).fill(name);
  const card = page.locator("article", { hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Tambah" }).click();

  await page.getByRole("button", { name: /Buka keranjang/ }).click();
  await page.getByLabel("Nama").fill("Pemesan E2E");
  await page.getByLabel("Unit / Ruangan").fill("Radiologi");
  await page.getByRole("switch", { name: /Jadwalkan/ }).click();
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Tanggal pakai").fill(date);
  await page.getByRole("button", { name: "Ajukan booking" }).click();
  await expect(page.getByText("Booking terkirim")).toBeVisible();

  // PENDING belum menahan stok.
  expect(await publicAvailable(request, name)).toBe(2);

  // ── Approve admin (filter loan berdasarkan barang — S4.2) ──
  const listRes = await request.get(`/api/admin/loans?itemId=${itemId}`);
  const { loans } = (await listRes.json()) as { loans: { id: number; status: string }[] };
  expect(loans.length).toBe(1);
  const loanId = loans[0].id;

  expect((await request.post(`/api/admin/loans/${loanId}/approve`)).ok()).toBeTruthy();
  expect(await publicAvailable(request, name)).toBe(1); // RESERVED menahan 1

  // ── Cancel admin → stok kembali ──
  expect((await request.post(`/api/admin/loans/${loanId}/cancel`)).ok()).toBeTruthy();
  expect(await publicAvailable(request, name)).toBe(2);
});
