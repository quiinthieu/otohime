import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic checks only (is there a session cookie?), so signed-out visitors
// get real status codes before anything streams. Pages still check the
// session and role themselves (lib/dal.ts).
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return;
  const { pathname } = request.nextUrl;
  // Signed-out visitors get the welcome page at /; signed-in ones the dashboard.
  if (pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url));
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", pathname);
  return NextResponse.redirect(signIn);
}

export const config = { matcher: ["/", "/account", "/admin/:path*"] };
