import { db } from "@/lib/db";
import { runTransition } from "@/lib/http/loan-actions";
import { rejectBooking } from "@/server/loan/service";

export const dynamic = "force-dynamic";

/** `POST /api/admin/loans/:id/reject` — PENDING → REJECTED (FR7). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runTransition((await ctx.params).id, (id) => rejectBooking(db, id), "reject gagal");
}
