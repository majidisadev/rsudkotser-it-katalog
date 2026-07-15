import { del, put } from "@vercel/blob";
import { type StorageAdapter, randomStorageKey } from "./index";

/**
 * Impl Vercel Blob (target Vercel) — dipilih saat STORAGE_DRIVER=vercel-blob.
 * Vendor-specific dikurung di file ini saja (SDD ADR-004): domain tak pernah
 * mengimpor `@vercel/blob`.
 */
export class VercelBlobStorage implements StorageAdapter {
  constructor(private readonly token: string) {}

  generateKey(ext?: string): string {
    return randomStorageKey(ext);
  }

  async put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<{ key: string; url: string }> {
    const blob = await put(key, Buffer.from(data), {
      access: "public",
      contentType,
      token: this.token,
      addRandomSuffix: false,
    });
    return { key, url: blob.url };
  }

  async delete(key: string): Promise<void> {
    await del(key, { token: this.token });
  }

  async url(key: string): Promise<string> {
    // Vercel Blob mengembalikan URL absolut saat put; url() by-key tak dipakai
    // untuk driver ini pada MVP.
    return key;
  }
}
