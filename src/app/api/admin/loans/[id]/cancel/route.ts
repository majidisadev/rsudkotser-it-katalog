import { db } from "@/lib/db";
import { runTransition } from "@/lib/http/loan-actions";
import { cancelLoan } from "@/server/loan/service";

export const dynamic = "force-dynamic";

/** `POST /api/admin/loans/:id/cancel` — RESERVED → CANCELLED, stok kembali. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runTransition((await ctx.params).id, (id) => cancelLoan(db, id), "cancel gagal");
}
