import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone untuk target Docker/self-host (SDD Build/Deployment). Diaktifkan
  // via env karena penyalinan trace standalone butuh symlink — gagal di Windows
  // (EPERM) tanpa Developer Mode. CI (Linux) & Docker menyetel NEXT_OUTPUT_STANDALONE=true.
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  // Paket native/server-only yang tak boleh di-bundle client (SDD boundary infra).
  serverExternalPackages: ["pino", "postgres", "@electric-sql/pglite", "sharp"],
};

export default nextConfig;
