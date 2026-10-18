import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Signed-out visitors get the welcome page at /; signed-in ones the dashboard.
// ponytail: cookie presence only; the dashboard re-checks the session and
// redirects a stale cookie to /sign-in.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.rewrite(new URL("/welcome", request.url));
  }
}

export const config = { matcher: "/" };
