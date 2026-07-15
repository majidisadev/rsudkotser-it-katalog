import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Klien Drizzle atas Postgres (postgres.js).
 * Satu driver melayani Neon (TCP pooler) maupun Postgres self-host — pilihan
 * penyedia hanya lewat `DATABASE_URL` (SDD ADR-002, NFR4). Boundary infra:
 * hanya modul ini yang mengimpor driver `postgres`.
 */
declare global {
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  return postgres(env.DATABASE_URL, { max: 10, prepare: false });
}

// Reuse koneksi di dev (hindari kehabisan koneksi saat HMR).
const client = globalThis.__pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
