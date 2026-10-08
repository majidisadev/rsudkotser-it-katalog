import { expect, test } from "@playwright/test";
import { adminLogin, createItem, publicAvailable } from "./helpers";

/**
 * Barang HABIS tetap bisa dibooking: tombol "Booking" memasukkan barang ke
 * keranjang sebagai booking-only → toggle booking otomatis aktif & terkunci
 * (peminjaman langsung tak mungkin). Stok baru divalidasi saat admin approve.
 */
test("barang habis → Booking → keranjang otomatis mode booking", async ({ page, request }) => {
  await adminLogin(request);
  const name = `E2E Habis ${Date.now()}`;
  const itemId = await createItem(request, name, 1);

  // Habiskan stok: booking via API lalu approve (RESERVED menahan 1).
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const create = await request.post("/api/loans", {
    multipart: {
      borrowerName: "Penahan Stok",
      borrowerUnit: "IGD",
      plannedDate: date,
      lines: JSON.stringify([{ itemId, quantity: 1 }]),
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const { loanId } = (await create.json()) as { loanId: number };
  expect((await request.post(`/api/admin/loans/${loanId}/approve`)).ok()).toBeTruthy();
  expect(await publicAvailable(request, name)).toBe(0);

  // ── UI publik: kartu habis menawarkan Booking (bukan tombol nonaktif) ──
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Cari barang" }).fill(name);
  const card = page.locator("article", { hasText: name });
  await expect(card.getByText("Habis", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Booking" }).click();
  await expect(card.getByLabel(`1 ${name}`)).toBeVisible();

  // ── Keranjang: toggle booking aktif & terkunci ──
  await page.getByRole("button", { name: /Buka keranjang/ }).click();
  const toggle = page.getByRole("switch", { name: /Jadwalkan/ });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toBeDisabled();
  await expect(page.getByText("Bukti serah-terima")).toHaveCount(0);

  await page.getByLabel("Nama").fill("Pemesan Habis");
  await page.getByLabel("Unit / Ruangan").fill("Radiologi");
  await page.getByLabel("Tanggal pakai").fill(date);
  await page.getByRole("button", { name: "Ajukan booking" }).click();
  await expect(page.getByText("Booking terkirim")).toBeVisible();

  const listRes = await request.get(`/api/admin/loans?itemId=${itemId}`);
  const { loans } = (await listRes.json()) as { loans: { status: string }[] };
  expect(loans.map((l) => l.status).sort()).toEqual(["PENDING", "RESERVED"]);
});
