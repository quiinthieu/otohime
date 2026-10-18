import { BrandMark } from "@/components/brand-mark";
import { NavLinks, NavList, SignOutButton, type NavItem } from "@/components/nav-links";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Suspense } from "react";

const BASE: NavItem[] = [{ href: "/", label: "Home" }];

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
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </header>
      <div className="lg:grid lg:grid-cols-[220px_1fr]">
        <nav aria-label="Main" className="appnav">
          <div className="mb-5 hidden lg:block">
            <p className="font-bold tracking-[0.02em]">Otohime</p>
            <p className="text-[12px] text-muted">A personal place.</p>
          </div>
          <Suspense fallback={<NavList items={BASE} />}>
            <NavLinks items={BASE} />
          </Suspense>
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </>
  );
}

async function Account() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="hidden truncate text-muted sm:inline">{session.user.email}</span>
      <SignOutButton />
    </div>
  );
}
