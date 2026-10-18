import { BrandMark } from "@/components/brand-mark";
import { Doodle } from "@/components/doodles";
import {
  NavLinks,
  NavList,
  SignOutButton,
  StopImpersonatingButton,
  type NavItem,
} from "@/components/nav-links";
import { getSession } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Suspense } from "react";

const BASE: NavItem[] = [{ href: "/", label: "Home", doodle: "shell" }];
const ADMIN: NavItem[] = [
  { href: "/admin/users", label: "Users", doodle: "fish" },
  { href: "/admin/roles", label: "Roles", doodle: "star" },
];

// The chrome prerenders; anything that reads the session streams in behind
// its own boundary, and pages stream behind loading.tsx.
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
          <Nav />
        </Suspense>
        <hr className="mt-auto" />
        <Suspense fallback={<div className="skeleton h-28" />}>
          <UserCard />
        </Suspense>
      </nav>
      <main id="main" tabIndex={-1} className="min-w-0 outline-none">
        <Suspense fallback={null}>
          <ImpersonationBanner />
        </Suspense>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

// The nav only hints; every gated page checks again (lib/dal.ts).
async function Nav() {
  const session = await getSession();
  const admin = can(session?.user.role, { user: ["list"] });
  return <NavLinks items={admin ? [...BASE, ...ADMIN] : BASE} />;
}

async function UserCard() {
  const session = await getSession();
  if (!session) return null;
  const { name, email } = session.user;
  const role = session.user.role ?? "user";

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
      <p>
        <span className="badge" data-role={role}>
          {role}
        </span>
      </p>
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
