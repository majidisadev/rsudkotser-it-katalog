import { type APIRequestContext, type Page, expect } from "@playwright/test";

/**
 * Helper e2e (S4.3) — setup via API (cepat & deterministik) + interaksi UI nyata.
 * Password admin dev = `admin123` (lihat `.env`); override via `E2E_ADMIN_PASSWORD`.
 */
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

/** Login admin pada konteks request (menyimpan cookie sesi untuk panggilan lanjutan). */
export async function adminLogin(request: APIRequestContext): Promise<void> {
  const res = await request.post("/api/admin/login", { data: { password: ADMIN_PASSWORD } });
  expect(res.ok(), "login admin gagal — cek ADMIN_PASSWORD_HASH/.env").toBeTruthy();
}

/** Buat barang via API admin (multipart). Mengembalikan id. */
export async function createItem(
  request: APIRequestContext,
  name: string,
  stockTotal: number,
): Promise<number> {
  const res = await request.post("/api/admin/items", {
    multipart: { name, stockTotal: String(stockTotal) },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).id as number;
}

/** Ketersediaan barang publik (dihitung server) — untuk assert invariant stok. */
export async function publicAvailable(
  request: APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.get(`/api/items?q=${encodeURIComponent(name)}`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { items: { name: string; available: number }[] };
  return body.items.find((i) => i.name === name)?.available ?? -1;
}

/** Menggambar tanda tangan pada kanvas bukti (jalur setara kamera, PRD R2). */
export async function drawSignature(page: Page): Promise<void> {
  const canvas = page.getByLabel("Area tanda tangan");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Kanvas tanda tangan tidak ditemukan");
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height - 30, { steps: 10 });
  await page.mouse.move(box.x + box.width - 40, box.y + 40, { steps: 10 });
  await page.mouse.up();
}
