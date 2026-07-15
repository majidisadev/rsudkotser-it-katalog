import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid: Record<string, string | undefined> = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/katalog",
  ADMIN_PASSWORD_HASH: "$argon2id$dummy",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  STORAGE_DRIVER: "local",
};

describe("env validation (S1.1 AC3)", () => {
  it("menerima env valid dan menerapkan default", () => {
    const env = parseEnv(valid);
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.ENABLE_VARIANTS).toBe(false);
    expect(env.RATE_LIMIT_MAX).toBe(60);
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("gagal-cepat menamai var wajib yang hilang", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({})).toThrow(/SESSION_SECRET/);
  });

  it("menolak SESSION_SECRET terlalu pendek", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "pendek" })).toThrow(/SESSION_SECRET/);
  });

  it("mewajibkan BLOB token saat driver vercel-blob", () => {
    expect(() => parseEnv({ ...valid, STORAGE_DRIVER: "vercel-blob" })).toThrow(
      /BLOB_READ_WRITE_TOKEN/,
    );
    expect(() =>
      parseEnv({ ...valid, STORAGE_DRIVER: "vercel-blob", BLOB_READ_WRITE_TOKEN: "tok" }),
    ).not.toThrow();
  });

  it("mengaktifkan ENABLE_VARIANTS dari string 'true'", () => {
    expect(parseEnv({ ...valid, ENABLE_VARIANTS: "true" }).ENABLE_VARIANTS).toBe(true);
  });
});
