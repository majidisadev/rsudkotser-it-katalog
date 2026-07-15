import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import {
  HOLDING_STATUSES,
  itemVariants,
  items,
  loanItems,
  loanProofs,
  loans,
} from "@/lib/db/schema";
import type { LoanStatus } from "@/lib/db/schema";
import type { LoansQuery } from "@/lib/validation/admin";

/**
 * Loan read-queries (Sprint 03) — sisi baca admin, terpisah dari Loan **service**
 * (yang tetap satu-satunya penulis status/stok, SDD invariant #5). Tabel
 * peminjaman (S6), detail modal, ringkasan dashboard (S4).
 */
export type QueryDb = PostgresJsDatabase<typeof schema>;

export interface LoanLineDTO {
  id: number;
  itemId: number;
  itemName: string;
  variantName: string | null;
  quantity: number;
  quantityReturned: number;
}

export interface LoanProofDTO {
  id: number;
  kind: "CHECKOUT" | "PICKUP" | "RETURN";
  storageKey: string;
  mime: string;
  createdAt: Date;
}

export interface LoanListRow {
  id: number;
  borrowerName: string;
  borrowerUnit: string;
  type: "DIRECT" | "BOOKING";
  status: LoanStatus;
  plannedDate: string | null;
  createdAt: Date;
  itemsSummary: string;
  lineCount: number;
}

export interface LoanDetail extends Omit<LoanListRow, "itemsSummary" | "lineCount"> {
  note: string | null;
  decidedAt: Date | null;
  activatedAt: Date | null;
  returnedAt: Date | null;
  lines: LoanLineDTO[];
  proofs: LoanProofDTO[];
}

/** Daftar peminjaman terfilter (SDD `GET /api/admin/loans`). */
export async function listLoans(db: QueryDb, query: LoansQuery = {}): Promise<LoanListRow[]> {
  const conds = [];
  if (query.status) conds.push(eq(loans.status, query.status));
  if (query.type) conds.push(eq(loans.type, query.type));
  if (query.q) {
    conds.push(
      or(ilike(loans.borrowerName, `%${query.q}%`), ilike(loans.borrowerUnit, `%${query.q}%`)),
    );
  }
  // Rentang tanggal peminjaman dibuat (createdAt) — inklusif, WIB harian.
  if (query.dateFrom) conds.push(gte(loans.createdAt, new Date(`${query.dateFrom}T00:00:00`)));
  if (query.dateTo) conds.push(lte(loans.createdAt, new Date(`${query.dateTo}T23:59:59.999`)));
  const rows = await db
    .select()
    .from(loans)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(loans.createdAt));

  const ids = rows.map((r) => r.id);
  const lineRows = ids.length
    ? await db
        .select({
          loanId: loanItems.loanId,
          quantity: loanItems.quantity,
          itemName: items.name,
        })
        .from(loanItems)
        .innerJoin(items, eq(loanItems.itemId, items.id))
        .where(inArray(loanItems.loanId, ids))
    : [];

  const byLoan = new Map<number, { name: string; quantity: number }[]>();
  for (const l of lineRows) {
    const list = byLoan.get(l.loanId) ?? [];
    list.push({ name: l.itemName, quantity: l.quantity });
    byLoan.set(l.loanId, list);
  }

  return rows.map((r) => {
    const lines = byLoan.get(r.id) ?? [];
    return {
      id: r.id,
      borrowerName: r.borrowerName,
      borrowerUnit: r.borrowerUnit,
      type: r.type,
      status: r.status,
      plannedDate: r.plannedDate,
      createdAt: r.createdAt,
      lineCount: lines.length,
      itemsSummary: lines.map((l) => `${l.name} ×${l.quantity}`).join(", "),
    };
  });
}

/** Detail satu peminjaman (modal S6) — baris + bukti. */
export async function getLoanDetail(db: QueryDb, id: number): Promise<LoanDetail | null> {
  const [loan] = await db.select().from(loans).where(eq(loans.id, id));
  if (!loan) return null;

  const lineRows = await db
    .select({
      id: loanItems.id,
      itemId: loanItems.itemId,
      itemName: items.name,
      variantName: itemVariants.name,
      quantity: loanItems.quantity,
      quantityReturned: loanItems.quantityReturned,
    })
    .from(loanItems)
    .innerJoin(items, eq(loanItems.itemId, items.id))
    .leftJoin(itemVariants, eq(loanItems.variantId, itemVariants.id))
    .where(eq(loanItems.loanId, id));

  const proofRows = await db
    .select({
      id: loanProofs.id,
      kind: loanProofs.kind,
      storageKey: loanProofs.storageKey,
      mime: loanProofs.mime,
      createdAt: loanProofs.createdAt,
    })
    .from(loanProofs)
    .where(eq(loanProofs.loanId, id))
    .orderBy(loanProofs.createdAt);

  return {
    id: loan.id,
    borrowerName: loan.borrowerName,
    borrowerUnit: loan.borrowerUnit,
    type: loan.type,
    status: loan.status,
    plannedDate: loan.plannedDate,
    createdAt: loan.createdAt,
    note: loan.note,
    decidedAt: loan.decidedAt,
    activatedAt: loan.activatedAt,
    returnedAt: loan.returnedAt,
    lines: lineRows,
    proofs: proofRows,
  };
}

export interface DashboardSummary {
  availableTotal: number;
  activeCount: number;
  reservedCount: number;
  pendingCount: number;
}

/** Ringkasan dashboard (S4 / FR15): tersedia, sedang, akan, menunggu. */
export async function dashboardSummary(db: QueryDb): Promise<DashboardSummary> {
  const [{ stock }] = await db
    .select({ stock: sql<number>`coalesce(sum(${items.stockTotal}), 0)::int` })
    .from(items);
  const [{ held }] = await db
    .select({
      held: sql<number>`coalesce(sum(${loanItems.quantity} - ${loanItems.quantityReturned}), 0)::int`,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loanItems.loanId, loans.id))
    .where(inArray(loans.status, [...HOLDING_STATUSES]));

  const statusRows = await db
    .select({ status: loans.status, c: sql<number>`count(*)::int` })
    .from(loans)
    .groupBy(loans.status);
  const countOf = (s: LoanStatus) => statusRows.find((r) => r.status === s)?.c ?? 0;

  return {
    availableTotal: Math.max(0, stock - held),
    activeCount: countOf("ACTIVE"),
    reservedCount: countOf("RESERVED"),
    pendingCount: countOf("PENDING"),
  };
}
