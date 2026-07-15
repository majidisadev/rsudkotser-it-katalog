import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — kerangka e2e (SDD Testing). Dua alur inti (checkout langsung;
 * booking→approve→return) diisi Sprint 02–04 saat alur tulis ada.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
