import { BrandMark } from "@/components/brand-mark";
import {
  NavLinks,
  NavList,
  SignOutButton,
  StopImpersonatingButton,
  type NavItem,
} from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/content/site";
import { getSession } from "@/lib/dal";
import { can } from "@/lib/permissions";
import Link from "next/link";
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

// The chrome prerenders; anything that reads the session streams in behind
// its own boundary, and pages stream behind loading.tsx.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="btn sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <header className="masthead">
        <BrandMark />
        <div className="flex min-w-0 items-center gap-3">
          <Suspense fallback={null}>
            <Account />
          </Suspense>
          <ThemeToggle />
        </div>
      </header>
      <Suspense fallback={null}>
        <ImpersonationBanner />
      </Suspense>
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

async function Account() {
  const session = await getSession();
  if (!session) {
    return (
      <Link href="/sign-in" className="btn">
        Sign in
      </Link>
    );
  }
  const role = session.user.role ?? "user";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="hidden truncate text-muted sm:inline">{session.user.email}</span>
      <span className="badge" data-role={role}>
        {role}
      </span>
      <SignOutButton />
    </div>
  );
}

async function ImpersonationBanner() {
  const session = await getSession();
  if (!session?.session.impersonatedBy) return null;

  return (
    <div className="banner">
      <p>
        You&apos;re impersonating {session.user.name} ({session.user.email})
      </p>
      <StopImpersonatingButton />
    </div>
  );
}
