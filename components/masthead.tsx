import { BrandMark } from "@/components/brand-mark";
import {
  CommandPaletteButton,
  NavLinks,
  NavList,
  SignOutButton,
  StopImpersonatingButton,
  type NavItem,
} from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/dal";
import { PUBLIC_PAGES } from "@/lib/pages";
import Link from "next/link";
import { Suspense } from "react";

const NAV_ITEMS: NavItem[] = [...PUBLIC_PAGES];

// The chrome every layout shares: a skip link, the sticky masthead and the
// impersonation banner. It prerenders; anything that reads the session
// streams in behind its own boundary.
export function Masthead() {
  return (
    <>
      <a
        href="#main"
        className="btn sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 shadow-md"
      >
        Skip to content
      </a>
      <header className="masthead">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-7">
            <div className="shrink-0 min-w-0">
              <BrandMark />
            </div>
            <nav aria-label="Primary" className="masthead-nav min-w-0 overflow-x-auto">
              <Suspense fallback={<NavList items={NAV_ITEMS} />}>
                <NavLinks items={NAV_ITEMS} />
              </Suspense>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="hidden sm:inline-flex">
              <CommandPaletteButton />
            </span>
            <Suspense fallback={null}>
              <Account />
            </Suspense>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <ImpersonationBanner />
      </Suspense>
    </>
  );
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
