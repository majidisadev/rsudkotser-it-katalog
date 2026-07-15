import { hash } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";

/**
 * verifyPassword (S3.1 AC1) — argon2id atas hash env (FR1/NFR5). Boundary infra:
 * hanya `src/lib/auth/*` menyentuh argon2.
 */
describe("verifyPassword (S3.1)", () => {
  it("menerima password yang benar", async () => {
    const h = await hash("rahasia-admin");
    expect(await verifyPassword(h, "rahasia-admin")).toBe(true);
  });

  it("menolak password yang salah", async () => {
    const h = await hash("rahasia-admin");
    expect(await verifyPassword(h, "salah")).toBe(false);
  });

  it("menolak hash tak valid / input kosong tanpa melempar", async () => {
    expect(await verifyPassword("bukan-hash-argon2", "apa pun")).toBe(false);
    expect(await verifyPassword("", "x")).toBe(false);
    expect(await verifyPassword("$argon2id$valid-ish", "")).toBe(false);
  });
});
