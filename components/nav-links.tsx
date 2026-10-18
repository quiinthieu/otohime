"use client";

import { Doodle, type DoodleName } from "@/components/doodles";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; doodle: DoodleName };

// Static list, also the Suspense fallback while usePathname resolves.
export function NavList({ items, pathname }: { items: NavItem[]; pathname?: string }) {
  return (
    <ul className="grid gap-1">
      {items.map(({ href, label, doodle }) => {
        const current =
          pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
              className="nav-item"
              aria-current={current ? "page" : undefined}
              // A client navigation leaves the mobile drawer open; close it.
              onClick={() => document.getElementById("nav")?.hidePopover()}
            >
              <Doodle name={doodle} className="wiggle size-6" />
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

export function SignOutButton() {
  return (
    <button
      type="button"
      className="btn btn-sm w-full"
      onClick={async () => {
        await authClient.signOut();
        location.href = "/";
      }}
    >
      Sign out
    </button>
  );
}
