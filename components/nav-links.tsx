"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type NavItem = { href: string; label: string };

// Static list, also the Suspense fallback while usePathname resolves.
export function NavList({ items, pathname }: { items: NavItem[]; pathname?: string }) {
  return (
    <ul className="nav-list">
      {items.map(({ href, label }) => {
        const current =
          pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link href={href} className="nav-item" aria-current={current ? "page" : undefined}>
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NavLinks({ items }: { items: NavItem[] }) {
  return <NavList items={items} pathname={usePathname()} />;
}

export function CommandPaletteButton() {
  return (
    <button
      type="button"
      className="btn btn-sm"
      aria-label="Open command palette"
      title="Command palette (⌘K or /)"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("otohime:open-terminal"));
      }}
    >
      <span className="hidden sm:inline">Jump</span>
      <kbd className="text-[11px] text-muted">⌘K</kbd>
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={async () => {
        await authClient.signOut();
        // back to the public front page
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function StopImpersonatingButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        await authClient.admin.stopImpersonating();
        router.push("/admin/users");
        router.refresh();
      }}
    >
      Stop impersonating
    </button>
  );
}
