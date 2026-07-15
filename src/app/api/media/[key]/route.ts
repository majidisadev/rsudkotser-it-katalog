import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Penyaji berkas media Local FS (`StorageAdapter.url()` → `/api/media/<key>`).
 * Dipakai untuk **foto barang** (publik) & **bukti** (URL kapabilitas — key
 * UUID tak-tertebak, SDD Security). Hanya aktif untuk driver `local`; di Vercel
 * Blob, `url()` mengembalikan URL blob langsung sehingga rute ini tak dipakai.
 *
 * Guard path-traversal: key wajib basename aman (tanpa `/`, `\`, `..`).
 */
const SAFE_KEY = /^[a-zA-Z0-9._-]+$/;

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!key || !SAFE_KEY.test(key) || key.includes("..")) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Key media tidak valid." } },
      { status: 400 },
    );
  }

  const root = resolve(process.cwd(), getEnv().LOCAL_STORAGE_PATH);
  const target = join(root, key);
  if (!target.startsWith(root)) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Key media tidak valid." } },
      { status: 400 },
    );
  }

  try {
    const data = await readFile(target);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Media tidak ditemukan." } },
      { status: 404 },
    );
  }
}
