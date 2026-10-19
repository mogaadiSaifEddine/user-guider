import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/tokens";

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = Boolean(await verifySession(cookie));
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/app") && !signedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    // A cookie that no longer verifies means the session ran out, not a first visit.
    if (cookie) url.searchParams.set("expired", "1");
    const res = NextResponse.redirect(url);
    if (cookie) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if ((pathname === "/login" || pathname === "/signup") && signedIn) {
    return NextResponse.redirect(new URL("/app", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/login", "/signup"] };
