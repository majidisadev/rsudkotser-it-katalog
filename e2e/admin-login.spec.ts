import { expect, test } from "@playwright/test";
import { ADMIN_PASSWORD } from "./helpers";

/**
 * Auth admin end-to-end + pass aksesibilitas ringan (S4.3): middleware
 * mengalihkan rute admin tanpa sesi; password salah → error berlabel (`role=alert`,
 * `aria-invalid`); password benar → masuk panel.
 */
test("guard mengalihkan ke login lalu masuk dengan password benar", async ({ page }) => {
  // Guard: rute admin tanpa sesi → redirect ke /admin/login?next=…
  await page.goto("/admin/barang");
  await expect(page).toHaveURL(/\/admin\/login/);

  const password = page.getByLabel("Kata sandi");
  await expect(password).toBeFocused(); // autoFocus (a11y)

  // Password salah → error berlabel.
  await password.fill("salah-sekali");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(password).toHaveAttribute("aria-invalid", "true");

  // Password benar → masuk panel & lanjut ke tujuan.
  await password.fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin(\/barang)?$/);
  await expect(page.getByRole("navigation", { name: "Navigasi admin" })).toBeVisible();
});
