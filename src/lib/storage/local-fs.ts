import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { type StorageAdapter, randomStorageKey } from "./index";

/**
 * Impl Local FS (self-host bervolume persisten). Aktif secara default —
 * tak butuh akun cloud. Bukti disajikan lewat rute `/api/media/<key>`
 * (ditambahkan bersama upload di Sprint 02).
 */
export class LocalFsStorage implements StorageAdapter {
  private readonly root: string;

  constructor(basePath: string) {
    this.root = resolve(process.cwd(), basePath);
  }

  generateKey(ext?: string): string {
    return randomStorageKey(ext);
  }

  async put(key: string, data: Buffer | Uint8Array, _contentType: string): Promise<{ key: string; url: string }> {
    const target = join(this.root, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    return { key, url: await this.url(key) };
  }

  async delete(key: string): Promise<void> {
    await rm(join(this.root, key), { force: true });
  }

  async url(key: string): Promise<string> {
    return `/api/media/${encodeURIComponent(key)}`;
  }
}
