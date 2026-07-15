import { verify } from "@node-rs/argon2";

/**
 * Verifikasi password admin (SDD ADR-007 / Security, FR1/NFR5). Boundary infra:
 * hanya modul ini yang mengimpor `@node-rs/argon2`. Password disimpan sebagai
 * hash argon2id di env (`ADMIN_PASSWORD_HASH`) — tak pernah plaintext.
 *
 * Model 1-admin: tak ada tabel users; satu-satunya kredensial adalah env.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (!hash || !plain) return false;
  try {
    return await verify(hash, plain);
  } catch {
    // Hash tak valid / bukan argon2 → anggap gagal (jangan bocorkan detail).
    return false;
  }
}
