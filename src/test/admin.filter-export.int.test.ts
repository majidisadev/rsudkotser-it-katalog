import { PGlite } from "@electric-sql/pglite";
import ExcelJS from "exceljs";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { categories } from "@/lib/db/schema";
import { createItem } from "@/server/catalog/admin";
import type { CatalogDb } from "@/server/catalog/service";
import { buildLoansWorkbook } from "@/server/loan/export";
import { listLoans, type QueryDb } from "@/server/loan/queries";
import { createBooking, createDirectLoan, type LoanDb } from "@/server/loan/service";

/**
 * Filter barang (S4.2) + ekspor Excel (S4.1) atas pglite. Membuktikan:
 * - `listLoans({ itemIds })` hanya mengembalikan peminjaman yang memuat barang terpilih.
 * - `buildLoansWorkbook` merakit sheet berisi header + baris terfilter.
 */
let db: CatalogDb & LoanDb & QueryDb;
let laptopId: number;
let proyektorId: number;

beforeAll(async () => {
  const client = new PGlite();
  const drizzleDb = drizzle(client, { schema });
  await migrate(drizzleDb, { migrationsFolder: "drizzle" });
  db = drizzleDb as unknown as CatalogDb & LoanDb & QueryDb;
  await drizzleDb.insert(categories).values({ name: "IT" });

  laptopId = await createItem(db, { name: "Laptop", stockTotal: 5, categoryId: null, description: null });
  proyektorId = await createItem(db, { name: "Proyektor", stockTotal: 5, categoryId: null, description: null });

  // A: hanya Laptop (DIRECT/ACTIVE).
  await createDirectLoan(db, {
    borrowerName: "Andi",
    borrowerUnit: "Poli",
    lines: [{ itemId: laptopId, quantity: 1 }],
    proof: { storageKey: "a.webp", mime: "image/webp", sizeBytes: 1 },
  });
  // B: hanya Proyektor (BOOKING/PENDING).
  await createBooking(db, {
    borrowerName: "Bella",
    borrowerUnit: "Radiologi",
    plannedDate: "2026-08-10",
    lines: [{ itemId: proyektorId, quantity: 1 }],
  });
  // C: Laptop + Proyektor (DIRECT/ACTIVE).
  await createDirectLoan(db, {
    borrowerName: "Cici",
    borrowerUnit: "Farmasi",
    lines: [
      { itemId: laptopId, quantity: 1 },
      { itemId: proyektorId, quantity: 1 },
    ],
    proof: { storageKey: "c.webp", mime: "image/webp", sizeBytes: 1 },
  });
});

describe("Filter barang listLoans (S4.2)", () => {
  it("itemIds menyaring peminjaman yang memuat barang terpilih", async () => {
    const laptop = await listLoans(db, { itemIds: [laptopId] });
    expect(laptop.map((l) => l.borrowerName).sort()).toEqual(["Andi", "Cici"]);

    const proyektor = await listLoans(db, { itemIds: [proyektorId] });
    expect(proyektor.map((l) => l.borrowerName).sort()).toEqual(["Bella", "Cici"]);

    // Beberapa barang → union (peminjaman yang memuat salah satu).
    const both = await listLoans(db, { itemIds: [laptopId, proyektorId] });
    expect(both).toHaveLength(3);
  });

  it("itemIds digabung dengan filter lain (AND)", async () => {
    // Laptop + hanya PENDING → tak ada (A & C keduanya ACTIVE).
    const pendingLaptop = await listLoans(db, { itemIds: [laptopId], status: "PENDING" });
    expect(pendingLaptop).toHaveLength(0);
    // Proyektor + PENDING → hanya Bella.
    const pendingProyektor = await listLoans(db, { itemIds: [proyektorId], status: "PENDING" });
    expect(pendingProyektor.map((l) => l.borrowerName)).toEqual(["Bella"]);
  });
});

describe("Ekspor Excel peminjaman (S4.1)", () => {
  it("merakit workbook berisi header + semua baris (tanpa filter)", async () => {
    const wb = await buildLoansWorkbook(db, {});
    const ws = wb.getWorksheet("Peminjaman")!;
    expect(ws.getRow(1).getCell(1).value).toBe("Peminjam");
    // baris 1 = header; 3 peminjaman → rowCount 4.
    expect(ws.rowCount).toBe(4);
    const names = [ws.getRow(2), ws.getRow(3), ws.getRow(4)].map((r) => r.getCell(1).value);
    expect(names).toContain("Andi");
    expect(names).toContain("Cici");
  });

  it("ekspor menghormati filter barang (filter-aware, ADR-008)", async () => {
    const wb = await buildLoansWorkbook(db, { itemIds: [laptopId] });
    const ws = wb.getWorksheet("Peminjaman")!;
    expect(ws.rowCount).toBe(3); // header + Andi + Cici
  });

  it("menghasilkan buffer .xlsx valid (dapat dibaca ulang)", async () => {
    const wb = await buildLoansWorkbook(db, {});
    const buffer = await wb.xlsx.writeBuffer();
    // Signature ZIP (xlsx = zip): 'PK'.
    expect(Buffer.from(buffer).subarray(0, 2).toString()).toBe("PK");
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);
    expect(reloaded.getWorksheet("Peminjaman")).toBeDefined();
  });
});
