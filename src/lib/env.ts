import { z } from "zod";

/**
 * Validasi environment (SDD *Configuration and Environments*, 12-factor).
 * Satu sumber kebenaran env; boot gagal-cepat saat var wajib hilang.
 * Nilai diakses lewat `env` (lazy) agar `next build` tidak menuntut rahasia
 * saat modul di-import — validasi dipicu saat properti pertama kali dibaca.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Database (Neon / Postgres self-host — DATABASE_URL sama di dua target).
    DATABASE_URL: z.string().min(1, "wajib diisi (Postgres connection string)"),

    // Storage media bukti (StorageAdapter — ADR-004).
    STORAGE_DRIVER: z.enum(["local", "vercel-blob"]).default("local"),
    LOCAL_STORAGE_PATH: z.string().default("./.storage"),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),

    // Rate limiting (Upstash — ADR-006). Opsional: absen → limiter in-memory.
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),

    // Auth admin (ADR-007) — dipakai penuh Sprint 03; divalidasi sejak awal.
    // Wajib hash argon2 utuh. CATATAN: di berkas `.env`, dotenv-expand milik
    // Next menafsirkan `$` sebagai variabel → escape tiap `$` menjadi `\$`
    // (di Vercel/env langsung tak perlu). Validasi `startsWith` menangkap hash
    // yang ter-mangle (gagal-cepat, bukan 401 senyap).
    ADMIN_PASSWORD_HASH: z
      .string()
      .min(1, "wajib diisi (hash argon2 password admin)")
      .startsWith(
        "$argon2",
        'harus hash argon2 valid — di berkas .env, escape tiap "$" menjadi "\\$" (dotenv-expand)',
      ),
    SESSION_SECRET: z.string().min(32, "minimal 32 karakter (syarat iron-session)"),

    APP_URL: z.string().url().default("http://localhost:3000"),
  })
  .superRefine((val, ctx) => {
    if (val.STORAGE_DRIVER === "vercel-blob" && !val.BLOB_READ_WRITE_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BLOB_READ_WRITE_TOKEN"],
        message: "wajib saat STORAGE_DRIVER=vercel-blob",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parse eksplisit — dipakai test & factory adapter. Melempar bila tidak valid. */
export function parseEnv(raw: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Konfigurasi environment tidak valid — ${issues}`);
  }
  return parsed.data;
}

let cached: Env | null = null;

/** Env tervalidasi & ter-cache. Validasi terjadi pada pemanggilan pertama. */
export function getEnv(): Env {
  if (cached === null) cached = parseEnv();
  return cached;
}

/** Reset cache — hanya untuk test. */
export function __resetEnvCache(): void {
  cached = null;
}

/** Akses ergonomis lazy: `env.DATABASE_URL`. Memicu validasi saat dibaca. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  },
});
