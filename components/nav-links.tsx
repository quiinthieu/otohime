"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type NavItem = { href: string; label: string };

// Static list, also the Suspense fallback while usePathname resolves.
// Pills on small screens, a "Fig. 01" captioned list from lg up (globals.css).
export function NavList({ items, pathname }: { items: NavItem[]; pathname?: string }) {
  return (
    <ul>
      {items.map(({ href, label }, i) => {
        const current =
          pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link href={href} className="nav-item" aria-current={current ? "page" : undefined}>
              <small aria-hidden="true">Fig. {String(i + 1).padStart(2, "0")}</small>
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
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={async () => {
        await authClient.signOut();
        // proxy.ts now rewrites / to the welcome page
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
