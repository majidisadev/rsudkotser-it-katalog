import { sql } from "drizzle-orm";
import { db } from "./index";
import { categories, items } from "./schema";
import { logger } from "../logger";

/**
 * Seed data contoh untuk demonstrasi katalog (Sprint 01) sebelum admin CRUD
 * (Sprint 03). Idempoten: hanya menyisipkan bila katalog masih kosong.
 */
async function seed() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items);

  if (count > 0) {
    logger.info({ count }, "Seed dilewati — katalog sudah berisi barang.");
    return;
  }

  const [presentasi, jaringan, komputasi] = await db
    .insert(categories)
    .values([{ name: "Presentasi" }, { name: "Jaringan" }, { name: "Komputasi" }])
    .returning();

  await db.insert(items).values([
    {
      name: "Proyektor Epson EB-X06",
      categoryId: presentasi.id,
      description: "Proyektor 3600 lumens untuk penyuluhan & rapat unit.",
      stockTotal: 3,
    },
    {
      name: "Laptop Lenovo ThinkPad",
      categoryId: komputasi.id,
      description: "Laptop kerja untuk presentasi & entri data.",
      stockTotal: 5,
    },
    {
      name: "Kabel HDMI 5m",
      categoryId: jaringan.id,
      description: "Kabel HDMI untuk sambungan proyektor/monitor.",
      stockTotal: 8,
    },
    {
      name: "Layar Proyektor Portabel",
      categoryId: presentasi.id,
      description: "Layar tripod 70 inci.",
      stockTotal: 2,
    },
    {
      name: "Switch Jaringan 8-Port",
      categoryId: jaringan.id,
      description: "Unmanaged switch gigabit.",
      stockTotal: 4,
    },
    {
      name: "Wireless Presenter",
      categoryId: presentasi.id,
      description: "Pointer presentasi nirkabel dengan laser.",
      stockTotal: 6,
    },
  ]);

  logger.info("Seed selesai — kategori & barang contoh dimuat.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Seed gagal");
    process.exit(1);
  });
