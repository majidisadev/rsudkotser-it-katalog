import sharp from "sharp";
import { MAX_PROOF_BYTES } from "@/lib/validation/loans";

/**
 * Pemrosesan bukti gambar (SDD *Security* / ADR-005, DoD #7). Boundary infra:
 * hanya modul ini yang mengimpor `sharp`. Server adalah otoritas ukuran/format
 * & pembersih EXIF:
 *  1. Validasi ukuran + magic-bytes (jpeg/png/webp) — tolak non-gambar.
 *  2. Re-encode via sharp → membuang metadata EXIF/GPS, membatasi dimensi,
 *     menstandarkan ke WebP (kecil, mendukung NFR6).
 *
 * Client sudah mengompres (browser-image-compression); langkah ini menjadikan
 * server sumber kebenaran (tak bisa di-bypass).
 */
export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

export interface ProcessedImage {
  data: Buffer;
  mime: "image/webp";
  ext: "webp";
  sizeBytes: number;
}

/** Deteksi tipe gambar dari magic-bytes (bukan sekadar percaya header MIME). */
export function sniffImage(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "png";
  // WEBP: "RIFF"...."WEBP"
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}

/** Batas dimensi keluaran (piksel) — bukti tak perlu resolusi penuh. */
const MAX_DIMENSION = 1600;

/**
 * Validasi + re-encode bukti. Melempar `ImageError` (→ 400 VALIDATION di route)
 * bila terlalu besar, bukan gambar yang dikenali, atau gagal di-decode.
 */
export async function processProofImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageError("Berkas bukti kosong.");
  if (input.length > MAX_PROOF_BYTES) {
    throw new ImageError("Ukuran berkas bukti terlalu besar.");
  }
  if (sniffImage(input) === null) {
    throw new ImageError("Berkas gambar tidak valid.");
  }

  let data: Buffer;
  try {
    data = await sharp(input, { failOn: "error" })
      .rotate() // terapkan orientasi EXIF sebelum metadata dibuang
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 }) // re-encode tanpa withMetadata → EXIF/GPS terbuang
      .toBuffer();
  } catch {
    throw new ImageError("Berkas gambar tidak valid.");
  }

  return { data, mime: "image/webp", ext: "webp", sizeBytes: data.length };
}
