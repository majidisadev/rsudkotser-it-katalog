import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone untuk target Docker/self-host (SDD Build/Deployment). Diaktifkan
  // via env karena penyalinan trace standalone butuh symlink — gagal di Windows
  // (EPERM) tanpa Developer Mode. CI (Linux) & Docker menyetel NEXT_OUTPUT_STANDALONE=true.
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  // Paket native/server-only yang tak boleh di-bundle client (SDD boundary infra).
  serverExternalPackages: ["pino", "postgres", "@electric-sql/pglite", "sharp", "exceljs"],
  images: {
    // Foto barang di Vercel Blob → di-resize & dikonversi next/image (thumbnail
    // kartu, bukan foto penuh). Key blob unik per unggahan → aman di-cache lama.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    // CSS (~8 KB) di-inline ke HTML → tak ada request CSS yang memblokir render.
    inlineCss: true,
  },
};

export default nextConfig;
