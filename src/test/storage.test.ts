import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Env } from "@/lib/env";
import { randomStorageKey, selectStorage } from "@/lib/storage";

const base = join(tmpdir(), `katalog-storage-test-${Date.now()}`);

function envWith(overrides: Partial<Env>): Env {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://x",
    STORAGE_DRIVER: "local",
    LOCAL_STORAGE_PATH: base,
    RATE_LIMIT_MAX: 60,
    RATE_LIMIT_WINDOW_SEC: 60,
    ADMIN_PASSWORD_HASH: "h",
    SESSION_SECRET: "0123456789abcdef",
    APP_URL: "http://localhost:3000",
    ENABLE_VARIANTS: false,
    ...overrides,
  } as Env;
}

afterAll(() => rm(base, { recursive: true, force: true }));

describe("StorageAdapter factory (S1.3 AC1/AC3/AC4)", () => {
  it("memilih Local FS secara default & menyimpan/menghapus berkas", async () => {
    const storage = await selectStorage(envWith({}));
    const key = storage.generateKey("png");
    const { url } = await storage.put(key, Buffer.from("halo"), "image/png");
    expect(url).toContain(encodeURIComponent(key));
    await storage.delete(key); // idempoten — tak melempar
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it("memilih Vercel Blob saat STORAGE_DRIVER=vercel-blob", async () => {
    const storage = await selectStorage(
      envWith({ STORAGE_DRIVER: "vercel-blob", BLOB_READ_WRITE_TOKEN: "tok" }),
    );
    expect(storage.constructor.name).toBe("VercelBlobStorage");
  });

  it("generateKey acak & tak mengekspos nama asli", () => {
    const a = randomStorageKey("jpg");
    const b = randomStorageKey("jpg");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}\.jpg$/);
  });
});
