import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests atas Postgres uji (pglite) — butuh migrasi di drizzle/.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/**/*.int.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
