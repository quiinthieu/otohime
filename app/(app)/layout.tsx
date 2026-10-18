import { Masthead } from "@/components/masthead";
import { NavLinks, NavList, type NavItem } from "@/components/nav-links";
import { site } from "@/content/site";
import { getSession } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Suspense } from "react";

// Public pages for everyone; signed-in people also get their own rooms.
const PUBLIC: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/work", label: "Work" },
  { href: "/play", label: "Play" },
  { href: "/notes", label: "Notes" },
];
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
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Masthead />
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
