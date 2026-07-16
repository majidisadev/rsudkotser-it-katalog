import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ImageError, processProofImage, sniffImage } from "@/lib/media/image";

/**
 * Pemrosesan bukti gambar (S2.2) — validasi magic-bytes, re-encode WebP, dan
 * pembuangan EXIF/GPS (SDD Security / DoD #7). Fixture dibuat lewat sharp
 * (tanpa berkas eksternal).
 */
async function makeJpeg(withGpsExif = false): Promise<Buffer> {
  let img = sharp({
    create: {
      width: 20,
      height: 20,
      channels: 3,
      background: { r: 200, g: 30, b: 30 },
    },
  });
  if (withGpsExif) {
    img = img.withExif({ IFD0: { Copyright: "RSUD Kota Serang" } });
  }
  return img.jpeg().toBuffer();
}

describe("sniffImage (S2.2)", () => {
  it("mengenali jpeg dari magic-bytes", async () => {
    expect(sniffImage(await makeJpeg())).toBe("jpeg");
  });
  it("mengenali png & webp", async () => {
    const png = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    const webp = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .webp()
      .toBuffer();
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(webp)).toBe("webp");
  });
  it("menolak non-gambar (null)", () => {
    expect(
      sniffImage(Buffer.from("bukan gambar, hanya teks biasa")),
    ).toBeNull();
  });
});

describe("processProofImage (S2.2)", () => {
  it("re-encode ke WebP yang valid", async () => {
    const out = await processProofImage(await makeJpeg());
    expect(out.mime).toBe("image/webp");
    expect(out.ext).toBe("webp");
    expect(out.sizeBytes).toBe(out.data.length);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
  });

  it("membuang metadata EXIF/GPS (privasi — SDD Security)", async () => {
    const withExif = await makeJpeg(true);
    // Input benar-benar membawa EXIF.
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processProofImage(withExif);
    // Keluaran tak lagi membawa EXIF.
    expect((await sharp(out.data).metadata()).exif).toBeUndefined();
  });

  it("membatasi dimensi ke ≤ 1600px", async () => {
    const big = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .jpeg()
      .toBuffer();
    const out = await processProofImage(big);
    const meta = await sharp(out.data).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      1600,
    );
  });

  it("menolak berkas kosong & non-gambar → ImageError", async () => {
    await expect(processProofImage(Buffer.alloc(0))).rejects.toBeInstanceOf(
      ImageError,
    );
    await expect(
      processProofImage(Buffer.from("halo dunia")),
    ).rejects.toBeInstanceOf(ImageError);
  });
});
