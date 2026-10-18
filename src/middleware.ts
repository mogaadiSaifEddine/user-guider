import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/tokens";

export async function middleware(req: NextRequest) {
  const signedIn = Boolean(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/app") && !signedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/signup") && signedIn) {
    return NextResponse.redirect(new URL("/app", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/login", "/signup"] };
