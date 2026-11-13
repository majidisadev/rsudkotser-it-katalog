import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests atas Postgres uji (pglite) — butuh migrasi di drizzle/.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Boot PGlite (WASM) + migrasi ~4–5 dtk per berkas; saat berkas berjalan
    // paralel bisa melewati batas default 10 dtk → beri ruang di beforeAll.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    include: ["src/test/**/*.int.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
