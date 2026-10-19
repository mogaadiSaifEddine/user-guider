import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/tokens";

// The session cookie is validly signed but its user no longer exists (deleted, or a
// different database). Clear it here: the middleware would otherwise send /login straight
// back to /app, which redirects to /login again.
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login?expired=1", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
