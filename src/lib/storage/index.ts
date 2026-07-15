import { randomUUID } from "node:crypto";
import type { Env } from "@/lib/env";
import { getEnv } from "@/lib/env";

/**
 * StorageAdapter (SDD ADR-004) — bukti media di balik satu interface agar
 * portabel dua target & tanpa vendor lock-in. Boundary infra: hanya modul di
 * `src/lib/storage/*` yang mengimpor SDK penyedia (`@vercel/blob`) / fs.
 */
export interface StorageAdapter {
  /** Simpan berkas terkompresi; kembalikan key + URL akses. */
  put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<{ key: string; url: string }>;
  /** Hapus berkas (idempoten — hilang dianggap sukses). */
  delete(key: string): Promise<void>;
  /** URL akses untuk sebuah key. */
  url(key: string): Promise<string>;
  /** Key acak tak-tertebak (SDD Security) — bukan nama asli file. */
  generateKey(ext?: string): string;
}

/** Key acak: `<uuid>.<ext>` tanpa mengekspos path/nama internal. */
export function randomStorageKey(ext = "bin"): string {
  const clean = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${randomUUID()}.${clean}`;
}

/** Pilih implementasi murni dari env (SDD Config). */
export async function selectStorage(env: Env = getEnv()): Promise<StorageAdapter> {
  if (env.STORAGE_DRIVER === "vercel-blob") {
    const { VercelBlobStorage } = await import("./vercel-blob");
    return new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN!);
  }
  const { LocalFsStorage } = await import("./local-fs");
  return new LocalFsStorage(env.LOCAL_STORAGE_PATH);
}

let cached: StorageAdapter | null = null;
/** Adapter storage aktif (cached). */
export async function getStorage(): Promise<StorageAdapter> {
  if (cached === null) cached = await selectStorage();
  return cached;
}
