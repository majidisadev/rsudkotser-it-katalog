import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — e2e (SDD Testing, S4.3). Dua alur inti (checkout langsung;
 * booking→approve→cancel) + auth admin. `webServer` menyajikan build produksi
 * (`pnpm build` harus sudah dijalankan; DB dev harus hidup — `docker compose up
 * -d db` + `pnpm db:migrate`). Tes tak paralel: berbagi satu DB/stok.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "pnpm build && pnpm start" : "pnpm start",
    url: "http://localhost:3000",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
