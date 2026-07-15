import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit/handler tests. Integration (pglite) dijalankan terpisah via vitest.int.config.ts.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/*.int.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
