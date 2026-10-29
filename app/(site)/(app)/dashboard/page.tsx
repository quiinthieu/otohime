import type { Metadata } from "next";
import { FigTitle, Figure } from "@/components/figures";
import { requireUser } from "@/lib/dal";
import { can, type Permissions } from "@/lib/permissions";
import Link from "next/link";
import { ViewTransition } from "react";

const rooms: { href: string; title: string; blurb: string; needs?: Permissions }[] = [
  { href: "/account", title: "Account", blurb: "Your name, password and devices." },
  {
    href: "/admin/users",
    title: "Users",
    blurb: "Roles, bans and sessions.",
    needs: { user: ["list"] },
  },
  {
    href: "/admin/roles",
    title: "Roles",
    blurb: "What each role can do.",
    needs: { user: ["list"] },
  },
  { href: "/admin/guestbook", title: "Guestbook", blurb: "Review the drawings waiting on the wall.", needs: { guestbook: ["moderate"] } },
];

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Dashboard&path=%2Fdashboard", width: 1200, height: 630, alt: "Dashboard, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { user } = await requireUser("/dashboard");
  const role = user.role ?? "user";
  const open = rooms.filter((room) => !room.needs || can(user.role, room.needs));

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle
          n="08"
          hint={
            <>
              signed in as {user.email}{" "}
              <span className="badge" data-role={role}>
                {role}
              </span>
            </>
          }
        >
          Hello, {user.name.split(" ")[0] || user.name}
        </FigTitle>
        <div className="mt-8 grid items-center gap-8 md:grid-cols-[1fr_minmax(0,20rem)]">
          {open.length ? (
            <ul className="grid content-start gap-3">
              {open.map(({ href, title, blurb }) => (
                <li key={href}>
                  <Link href={href} className="card card-link">
                    <span>
                      <span className="block font-semibold">
                        {title} <span aria-hidden="true">→</span>
                      </span>
                      <span className="text-muted">{blurb}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">You&apos;re in. There&apos;s nothing else to open yet.</p>
          )}
          <Figure kind="open-lock" className="mx-auto block w-full max-w-xs" />
        </div>
      </div>
    </ViewTransition>
  );
}
