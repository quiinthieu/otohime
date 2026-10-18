import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { can, type Permissions } from "./permissions";

// One session read per request. React cache, not 'use cache: private', so a
// demoted or banned user never sees a browser-cached gated view.
// disableRefresh: Server Components can't set the refreshed cookie anyway.
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } }),
);

// Call these first thing in a gated page, before it reads any data.
// proxy.ts already sends signed-out visitors a real 307; these catch stale
// cookies and wrong roles.
// ponytail: pages stream (Cache Components flushes the static shell first), so
// forbidden() renders the 403 UI with a 200 status and a noindex tag. Move the
// role check into proxy.ts if a real 403 status ever matters.
export async function requireUser(path: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  return session;
}

export async function requirePermission(path: string, permissions: Permissions) {
  const session = await requireUser(path);
  if (!can(session.user.role, permissions)) forbidden();
  return session;
}
