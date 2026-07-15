import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Skema Drizzle / Postgres — SDD *Data Design*.
 * Konvensi: tabel & kolom snake_case; kuantitas integer; audit timestamptz;
 * `planned_date` = date (tanpa timezone). Ketersediaan TIDAK dipersistensi
 * (dihitung — lihat server/catalog). Tidak ada tabel users (model 1-admin).
 */

export const loanTypeEnum = pgEnum("loan_type", ["DIRECT", "BOOKING"]);

export const loanStatusEnum = pgEnum("loan_status", [
  "PENDING",
  "RESERVED",
  "ACTIVE",
  "RETURNED",
  "REJECTED",
  "CANCELLED",
]);

export const proofKindEnum = pgEnum("proof_kind", ["CHECKOUT", "PICKUP", "RETURN"]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    photoKey: text("photo_key"),
    photoUrl: text("photo_url"),
    assetNo: text("asset_no"), // Could (OA7) — disiapkan, non-breaking bila dipakai nanti
    hasVariants: boolean("has_variants").notNull().default(false),
    stockTotal: integer("stock_total").notNull().default(0), // dipakai bila hasVariants=false
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("items_category_id_idx").on(t.categoryId)],
);

export const itemVariants = pgTable(
  "item_variants",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    stockTotal: integer("stock_total").notNull().default(0),
  },
  (t) => [index("item_variants_item_id_idx").on(t.itemId)],
);

export const loans = pgTable(
  "loans",
  {
    id: serial("id").primaryKey(),
    borrowerName: text("borrower_name").notNull(),
    borrowerUnit: text("borrower_unit").notNull(),
    type: loanTypeEnum("type").notNull(),
    status: loanStatusEnum("status").notNull(),
    plannedDate: date("planned_date"), // pembeda booking (tanggal rencana pakai)
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
  },
  (t) => [
    index("loans_status_idx").on(t.status),
    index("loans_created_at_idx").on(t.createdAt),
    index("loans_planned_date_idx").on(t.plannedDate),
  ],
);

export const loanItems = pgTable(
  "loan_items",
  {
    id: serial("id").primaryKey(),
    loanId: integer("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    variantId: integer("variant_id").references(() => itemVariants.id, {
      onDelete: "restrict",
    }),
    quantity: integer("quantity").notNull(),
    quantityReturned: integer("quantity_returned").notNull().default(0),
  },
  (t) => [
    index("loan_items_item_id_idx").on(t.itemId),
    index("loan_items_variant_id_idx").on(t.variantId),
    index("loan_items_loan_id_idx").on(t.loanId),
  ],
);

export const loanProofs = pgTable("loan_proofs", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id")
    .notNull()
    .references(() => loans.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  kind: proofKindEnum("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    message: text("message").notNull(),
    loanId: integer("loan_id").references(() => loans.id, { onDelete: "set null" }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_unread_idx").on(t.isRead, t.createdAt)],
);

// Status peminjaman yang MENAHAN stok (invariant ketersediaan — SDD Data Design).
export const HOLDING_STATUSES = ["RESERVED", "ACTIVE"] as const;

export type Item = typeof items.$inferSelect;
export type ItemVariant = typeof itemVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type LoanItem = typeof loanItems.$inferSelect;
export type LoanStatus = (typeof loanStatusEnum.enumValues)[number];
