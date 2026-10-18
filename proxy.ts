import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only (is there a session cookie?), so signed-out visitors
// get a real redirect before anything streams. Pages still check the session
// and role themselves (lib/dal.ts). Public pages aren't matched.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return;
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = { matcher: ["/dashboard", "/account", "/admin/:path*"] };
