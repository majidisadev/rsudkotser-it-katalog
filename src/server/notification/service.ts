import { desc, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { notifications } from "@/lib/db/schema";

/**
 * Notification service — owner `notifications` (SDD Component Map). Notifikasi
 * in-app via **polling** (ADR-010): admin panel menarik daftar + unread count
 * berkala. Pembuatan notifikasi "booking baru" ada di Loan service (Flow 2).
 */
export type NotifDb = PostgresJsDatabase<typeof schema>;

export interface NotificationDTO {
  id: number;
  type: string;
  message: string;
  loanId: number | null;
  isRead: boolean;
  createdAt: Date;
}

export async function listNotifications(
  db: NotifDb,
  opts: { limit?: number } = {},
): Promise<{ items: NotificationDTO[]; unread: number }> {
  const items = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit ?? 30);
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*) filter (where ${notifications.isRead} = false)::int` })
    .from(notifications);
  return { items, unread };
}

export async function unreadCount(db: NotifDb): Promise<number> {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.isRead, false));
  return c;
}

/** Tandai baca: `ids` tertentu, atau semua yang belum dibaca bila kosong. */
export async function markRead(db: NotifDb, ids?: number[]): Promise<void> {
  if (ids && ids.length > 0) {
    await db.update(notifications).set({ isRead: true }).where(inArray(notifications.id, ids));
  } else {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
  }
}

/** Hapus notifikasi: `ids` tertentu, atau **semua** bila kosong. */
export async function deleteNotifications(db: NotifDb, ids?: number[]): Promise<void> {
  if (ids && ids.length > 0) {
    await db.delete(notifications).where(inArray(notifications.id, ids));
  } else {
    await db.delete(notifications);
  }
}
