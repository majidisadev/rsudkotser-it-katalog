import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit — migrasi SQL versioned di repo (SDD Data Design).
 * `DATABASE_URL` diambil dari environment (lihat .env / .env.example).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/katalog",
  },
  strict: true,
  verbose: true,
});
