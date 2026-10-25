import { EndFooter } from "@/components/end-footer";
import { Masthead } from "@/components/masthead";
import { NavLinks, NavList, type NavItem } from "@/components/nav-links";
import { site } from "@/content/site";
import { getSession } from "@/lib/dal";
import { PUBLIC_PAGES } from "@/lib/pages";
import { can } from "@/lib/permissions";
import { Suspense, ViewTransition } from "react";

// Public pages for everyone; signed-in people also get their own rooms.
const PUBLIC: NavItem[] = [...PUBLIC_PAGES];
const MINE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account", label: "Account" },
];
const ADMIN: NavItem[] = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Roles" },
];

// The pages with the sidebar. The chrome prerenders; the nav reads the
// session behind its own boundary, and pages stream behind loading.tsx.
//
// React runs a <ViewTransition>'s enter and exit only when it sits above every
// DOM node that is inserted or removed. Moving to or from another group's
// layout ((home), (auth)) swaps this whole layout, so the pages' own wrappers,
// inside <main>, never fire; this one, around everything below the masthead,
// does. Inside the group the layout stays, default="none" keeps it still, and
// the pages hand over with their own wrappers.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Masthead />
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <div className="lg:grid lg:grid-cols-[220px_1fr]">
          <nav aria-label="Main" className="appnav">
            <div className="mb-5 hidden lg:block">
              <p className="font-bold tracking-[0.02em]">Otohime</p>
              <p className="text-[12px] text-muted">{site.tagline}</p>
            </div>
            <Suspense fallback={<NavList items={PUBLIC} />}>
              <Nav />
            </Suspense>
          </nav>
          <main id="main" tabIndex={-1} className="min-w-0 outline-none">
            <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:py-8">{children}</div>
          </main>
        </div>
        <EndFooter />
      </ViewTransition>
    </>
  );
}

// The nav only hints; every gated page checks again (lib/dal.ts).
async function Nav() {
  const session = await getSession();
  if (!session) return <NavLinks items={PUBLIC} />;
  const admin = can(session.user.role, { user: ["list"] });
  return <NavLinks items={[...PUBLIC, ...MINE, ...(admin ? ADMIN : [])]} />;
}
