import { getStorage } from "@/lib/storage";
import { processProofImage } from "./image";

/**
 * Proses + simpan sebuah berkas gambar (foto barang / bukti) lewat pipeline
 * bersama: validasi + re-encode WebP (buang EXIF/GPS — SDD Security) lalu
 * `StorageAdapter.put`. Mengembalikan key + url + metadata. Melempar
 * `ImageError` (→ 400) bila bukan gambar valid.
 */
export async function storeImageFile(
  file: File,
): Promise<{ key: string; url: string; mime: string; sizeBytes: number }> {
  const processed = await processProofImage(Buffer.from(await file.arrayBuffer()));
  const storage = await getStorage();
  const key = storage.generateKey(processed.ext);
  const { key: storedKey, url } = await storage.put(key, processed.data, processed.mime);
  return { key: storedKey, url, mime: processed.mime, sizeBytes: processed.sizeBytes };
}
