import { FigTitle } from "@/components/figures";
import { SessionList } from "@/components/session-list";
import { UserActions } from "@/components/user-actions";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/dal";
import { mayAct, roles, type RoleName } from "@/lib/permissions";
import { isAPIError } from "better-auth/api";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "User" };

const joined = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const me = await requirePermission(`/admin/users/${id}`, { user: ["get"] });
  const requestHeaders = await headers();

  let user;
  try {
    user = await auth.api.getUser({ query: { id }, headers: requestHeaders });
  } catch (error) {
    if (isAPIError(error) && error.statusCode === 404) notFound();
    throw error;
  }

  const role = user.role ?? "user";
  const manageable = mayAct(me.user.role, user.role);
  // Session tokens stay on the server: the list shows devices, and revoking
  // goes by user id ("Revoke all").
  const sessions = manageable
    ? (await auth.api.listUserSessions({ body: { userId: id }, headers: requestHeaders })).sessions.map(
        ({ id, userAgent, ipAddress, updatedAt }) => ({ id, userAgent, ipAddress, updatedAt }),
      )
    : [];
  const assignable = (Object.keys(roles) as RoleName[]).filter((r) =>
    mayAct(me.user.role, user.role, [r]),
  );

  return (
    <div className="rise grid gap-6">
      <Link href="/admin/users" className="link w-fit">
        ← Users
      </Link>
      <div>
        <FigTitle n="08" hint={user.email}>
          {user.name}
        </FigTitle>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className="badge" data-role={role}>
            {role}
          </span>
          {user.banned ? (
            <span className="badge" data-tone="danger">
              Banned
            </span>
          ) : null}
          <span className="text-muted">joined {joined.format(new Date(user.createdAt))}</span>
        </p>
      </div>

      {manageable ? (
        <UserActions
          user={{
            id: user.id,
            name: user.name,
            role,
            banned: Boolean(user.banned),
            banReason: user.banReason,
          }}
          assignable={assignable}
          sessions={<SessionList sessions={sessions} empty="Not signed in anywhere." />}
        />
      ) : (
        <p className="alert" data-tone="info">
          {user.id === me.user.id
            ? "This is you. Manage your own account from the Account page."
            : "Their role is at or above yours, so this page is read-only."}
        </p>
      )}
    </div>
  );
}
