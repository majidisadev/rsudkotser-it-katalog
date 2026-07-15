import type { IronSession } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import type { AdminSession } from "./session-config";
import { sessionOptions } from "./session-config";

export type { AdminSession } from "./session-config";
export { SESSION_COOKIE, SESSION_MAX_AGE } from "./session-config";

/**
 * Sesi admin untuk Route Handler / Server Component (via `next/headers`).
 * Middleware memakai `session-config` langsung (edge — tanpa next/headers).
 */
export async function getSession(): Promise<IronSession<AdminSession>> {
  return getIronSession<AdminSession>(await cookies(), sessionOptions());
}
