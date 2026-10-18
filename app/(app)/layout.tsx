import { BrandMark } from "@/components/brand-mark";
import { Doodle } from "@/components/doodles";
import { NavLinks, NavList, SignOutButton, type NavItem } from "@/components/nav-links";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Suspense } from "react";

const BASE: NavItem[] = [{ href: "/", label: "Home", doodle: "shell" }];

// Pages in this group block on the server (export const instant = false), so
// redirect() and forbidden() keep real 307/403 status codes.
// ponytail: never wrap {children} in Suspense or add a loading.tsx here; either
// one streams gated pages as 200. Navigations block until the page is ready.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#main"
        className="btn sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <header className="topbar lg:hidden">
        <BrandMark morph={false} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          popoverTarget="nav"
          aria-label="Open menu"
        >
          <Doodle name="menu" className="size-6" />
        </button>
      </header>
      <nav id="nav" popover="auto" aria-label="Main" className="sidebar">
        <div className="hidden lg:block">
          <BrandMark />
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm self-end lg:hidden"
          popoverTarget="nav"
          popoverTargetAction="hide"
          aria-label="Close menu"
        >
          <Doodle name="close" className="size-6" />
        </button>
        <Suspense fallback={<NavList items={BASE} />}>
          <NavLinks items={BASE} />
        </Suspense>
        <hr className="mt-auto" />
        <Suspense fallback={<div className="skeleton h-24" />}>
          <UserCard />
        </Suspense>
      </nav>
      <main id="main" tabIndex={-1} className="min-w-0 outline-none">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

async function UserCard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { name, email } = session.user;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <span className="avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold">{name}</p>
          <p className="truncate text-sm text-muted">{email}</p>
        </div>
      </div>
      <SignOutButton />
    </div>
  );
}
