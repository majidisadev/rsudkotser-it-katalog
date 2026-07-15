import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { categories, items, loanItems } from "@/lib/db/schema";
import { createItem } from "@/server/catalog/admin";
import type { CatalogDb } from "@/server/catalog/service";
import {
  dashboardSummary,
  getLoanDetail,
  listLoans,
  type QueryDb,
} from "@/server/loan/queries";
import {
  approveBooking,
  createBooking,
  createDirectLoan,
  type LoanDb,
} from "@/server/loan/service";
import {
  deleteNotifications,
  listNotifications,
  markRead,
  unreadCount,
} from "@/server/notification/service";
import type { NotifDb } from "@/server/notification/service";

/** Integration read-queries admin + notifikasi (S3.4) atas pglite. */
let db: CatalogDb & LoanDb & QueryDb & NotifDb;

beforeAll(async () => {
  const client = new PGlite();
  const drizzleDb = drizzle(client, { schema });
  await migrate(drizzleDb, { migrationsFolder: "drizzle" });
  db = drizzleDb as unknown as CatalogDb & LoanDb & QueryDb & NotifDb;
  await drizzleDb.insert(categories).values({ name: "Presentasi" });
});

describe("Admin loan queries + notifications (S3.4)", () => {
  it("listLoans memfilter status/tipe/q + ringkasan barang", async () => {
    const projId = await createItem(db, { name: "Proyektor Q", stockTotal: 5, categoryId: null, description: null });
    await createDirectLoan(db, {
      borrowerName: "Sinta",
      borrowerUnit: "Anak",
      lines: [{ itemId: projId, quantity: 2 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    });
    await createBooking(db, {
      borrowerName: "Budi",
      borrowerUnit: "Radiologi",
      plannedDate: "2026-07-25",
      lines: [{ itemId: projId, quantity: 1 }],
    });

    const all = await listLoans(db, {});
    expect(all.length).toBeGreaterThanOrEqual(2);

    const direct = await listLoans(db, { type: "DIRECT" });
    expect(direct.every((r) => r.type === "DIRECT")).toBe(true);

    const pending = await listLoans(db, { status: "PENDING" });
    expect(pending.every((r) => r.status === "PENDING")).toBe(true);

    const byName = await listLoans(db, { q: "sinta" });
    expect(byName.some((r) => r.borrowerName === "Sinta")).toBe(true);
    const sinta = byName.find((r) => r.borrowerName === "Sinta")!;
    expect(sinta.itemsSummary).toContain("Proyektor Q ×2");

    // Rentang tanggal dibuat (createdAt = hari ini).
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect((await listLoans(db, { dateFrom: today, dateTo: today })).length).toBe(all.length);
    expect((await listLoans(db, { dateFrom: tomorrow })).length).toBe(0);
  });

  it("getLoanDetail mengembalikan baris + bukti; null bila tak ada", async () => {
    const id = await createItem(db, { name: "Detail-Item", stockTotal: 3, categoryId: null, description: null });
    const { loanId } = await createDirectLoan(db, {
      borrowerName: "Rina",
      borrowerUnit: "Farmasi",
      lines: [{ itemId: id, quantity: 1 }],
      proof: { storageKey: "proof.webp", mime: "image/webp", sizeBytes: 1 },
    });
    const detail = await getLoanDetail(db, loanId);
    expect(detail).not.toBeNull();
    expect(detail!.lines).toHaveLength(1);
    expect(detail!.lines[0].itemName).toBe("Detail-Item");
    expect(detail!.proofs).toHaveLength(1);
    expect(detail!.proofs[0].kind).toBe("CHECKOUT");

    expect(await getLoanDetail(db, 999999)).toBeNull();
  });

  it("dashboardSummary menghitung tersedia/sedang/akan/menunggu", async () => {
    // Reset agar deterministik.
    await db.delete(loanItems);
    await db.delete(schema.loans);
    await db.delete(items);
    const a = await createItem(db, { name: "Sum-A", stockTotal: 10, categoryId: null, description: null });

    await createDirectLoan(db, {
      borrowerName: "X",
      borrowerUnit: "U",
      lines: [{ itemId: a, quantity: 3 }],
      proof: { storageKey: "k.webp", mime: "image/webp", sizeBytes: 1 },
    }); // ACTIVE, tahan 3
    const booking = await createBooking(db, {
      borrowerName: "Y",
      borrowerUnit: "U",
      plannedDate: "2026-07-25",
      lines: [{ itemId: a, quantity: 2 }],
    }); // PENDING
    await approveBooking(db, booking.loanId); // RESERVED, tahan 2

    const s = await dashboardSummary(db);
    expect(s.availableTotal).toBe(5); // 10 − (3 + 2)
    expect(s.activeCount).toBe(1);
    expect(s.reservedCount).toBe(1);
    expect(s.pendingCount).toBe(0);
  });

  it("notifikasi: list + unread count + markRead", async () => {
    await db.delete(schema.notifications);
    const id = await createItem(db, { name: "Notif-Item", stockTotal: 2, categoryId: null, description: null });
    const b = await createBooking(db, {
      borrowerName: "Z",
      borrowerUnit: "U",
      plannedDate: "2026-07-25",
      lines: [{ itemId: id, quantity: 1 }],
    });

    expect(await unreadCount(db)).toBe(1);
    const { items: notifs, unread } = await listNotifications(db);
    expect(unread).toBe(1);
    expect(notifs[0].type).toBe("BOOKING_NEW");
    expect(notifs[0].loanId).toBe(b.loanId);

    await markRead(db);
    expect(await unreadCount(db)).toBe(0);

    await deleteNotifications(db);
    expect((await listNotifications(db)).items).toHaveLength(0);
  });
});
