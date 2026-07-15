import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { type AdminSession, sessionOptions } from "@/lib/auth/session-config";

/**
 * Middleware — menegakkan sesi admin untuk seluruh `/admin/*` & `/api/admin/*`
 * (SDD *Security* / *Component Map*). Pengecualian: halaman `/admin/login` &
 * endpoint `POST /api/admin/login` (harus bisa diakses tanpa sesi).
 *
 * Belum login: rute halaman → redirect ke `/admin/login?next=…`; rute API →
 * `401 UNAUTHORIZED` (amplop seragam). Sudah login: cookie diperpanjang
 * (sliding renewal — FR2).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Endpoint login publik — dilewati (rate-limit + verifikasi di route sendiri).
  if (pathname === "/api/admin/login") return NextResponse.next();

  const res = NextResponse.next();
  const session = await getIronSession<AdminSession>(req, res, sessionOptions());
  const authed = session.isAdmin === true;

  if (pathname === "/admin/login") {
    // Sudah login → tak perlu form login lagi.
    if (authed) return NextResponse.redirect(new URL("/admin", req.url));
    return res;
  }

  if (!authed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sesi admin diperlukan. Silakan login." } },
        { status: 401 },
      );
    }
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Perpanjang masa berlaku (sliding renewal) pada request admin terautentikasi.
  await session.save();
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
