import { FigTitle, Notice } from "@/components/figures";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/dal";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 20;
const joined = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requirePermission("/admin/users", { user: ["list"] });
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);

  const { users, total } = await auth.api.listUsers({
    headers: await headers(),
    query: {
      // ponytail: email search only; add searchField "name" when it's missed
      ...(q && { searchValue: q.toLowerCase(), searchField: "email", searchOperator: "contains" }),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) =>
    `/admin/users?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="09" hint={`${total} ${total === 1 ? "person" : "people"}${q ? ` matching “${q}”` : ""}`}>
          Users
        </FigTitle>
        <form role="search" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="q" className="label">
              Search by email
            </label>
            <input id="q" name="q" type="search" defaultValue={q} className="field" />
          </div>
          <button type="submit" className="btn">
            Search
          </button>
        </form>

        {users.length ? (
          <div className="card table-wrap mt-6">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="max-w-0 min-w-40">
                      <Link href={`/admin/users/${user.id}`} className="row-link block truncate font-bold">
                        {user.name}
                      </Link>
                      <span className="block truncate text-sm text-muted">{user.email}</span>
                    </td>
                    <td>
                      <span className="badge" data-role={user.role ?? "user"}>
                        {user.role ?? "user"}
                      </span>
                    </td>
                    <td>
                      {user.banned ? (
                        <span className="badge" data-tone="danger">
                          Banned
                        </span>
                      ) : (
                        <span className="badge" data-tone="ok">Active</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell">
                      <time dateTime={new Date(user.createdAt).toISOString()}>
                        {joined.format(new Date(user.createdAt))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Notice n="—" title="No one by that email" figure="parcel" heading="h2">
            <p className="text-muted">Try another email.</p>
          </Notice>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="btn btn-sm">
                Previous
              </Link>
            ) : (
              <span className="btn btn-sm" aria-disabled="true">
                Previous
              </span>
            )}
            <span className="text-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className="btn btn-sm">
                Next
              </Link>
            ) : (
              <span className="btn btn-sm" aria-disabled="true">
                Next
              </span>
            )}
          </nav>
        ) : null}
      </div>
    </ViewTransition>
  );
}
