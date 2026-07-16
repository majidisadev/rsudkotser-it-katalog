import ExcelJS from "exceljs";
import type { LoansQuery } from "@/lib/validation/admin";
import type { LoanStatus } from "@/lib/db/schema";
import { formatDate, formatDateTime } from "@/lib/utils";
import { listLoans, type QueryDb } from "./queries";

/**
 * Ekspor Excel daftar peminjaman (FR13, ADR-008 — ExcelJS, server-side).
 * **Filter-aware:** memakai `listLoans` dengan query yang sama persis dengan
 * tabel admin (status/tipe/cari/rentang tanggal/barang) sehingga hasil ekspor
 * konsisten dengan yang dilihat admin. Server-only (ExcelJS tak masuk bundle
 * client — dipanggil dari route handler).
 */

const STATUS_LABEL: Record<LoanStatus, string> = {
  PENDING: "Menunggu",
  RESERVED: "Disetujui",
  ACTIVE: "Dipinjam",
  RETURNED: "Selesai",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

/** Rakit workbook dari peminjaman terfilter. Satu sheet "Peminjaman". */
export async function buildLoansWorkbook(
  db: QueryDb,
  query: LoansQuery = {},
): Promise<ExcelJS.Workbook> {
  const rows = await listLoans(db, query);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Katalog IT RSUD Kotser";
  wb.created = new Date();

  const ws = wb.addWorksheet("Peminjaman", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Peminjam", key: "borrowerName", width: 24 },
    { header: "Unit", key: "borrowerUnit", width: 22 },
    { header: "Tipe", key: "type", width: 12 },
    { header: "Status", key: "status", width: 14 },
    { header: "Barang", key: "items", width: 44 },
    { header: "Tanggal Dibuat", key: "createdAt", width: 26 },
    { header: "Tanggal Rencana", key: "plannedDate", width: 16 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle" };

  for (const l of rows) {
    ws.addRow({
      borrowerName: l.borrowerName,
      borrowerUnit: l.borrowerUnit,
      type: l.type === "BOOKING" ? "Booking" : "Langsung",
      status: STATUS_LABEL[l.status],
      items: l.itemsSummary || "—",
      createdAt: formatDateTime(l.createdAt),
      plannedDate: l.plannedDate ? formatDate(l.plannedDate) : "—",
    });
  }

  return wb;
}

/** Nama berkas ekspor bertanggal, mis. `peminjaman-2026-08-05.xlsx`. */
export function exportFileName(now: Date = new Date()): string {
  return `peminjaman-${now.toISOString().slice(0, 10)}.xlsx`;
}
