import { db } from "@/lib/db";
import { runTransition } from "@/lib/http/loan-actions";
import { approveBooking } from "@/server/loan/service";

export const dynamic = "force-dynamic";

/** `POST /api/admin/loans/:id/approve` — PENDING → RESERVED, tahan stok (FR8). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runTransition((await ctx.params).id, (id) => approveBooking(db, id), "approve gagal");
}
