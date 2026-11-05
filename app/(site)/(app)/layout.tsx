import { EndFooter } from "@/components/end-footer";
import { Masthead } from "@/components/masthead";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { getSession } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Suspense, ViewTransition } from "react";

const MINE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account", label: "Account" },
];
const ADMIN: NavItem[] = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/bottles", label: "Bottles" },
];

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
        <div className="min-w-0">
          <Suspense fallback={null}>
            <SignedInNav />
          </Suspense>
          <main id="main" tabIndex={-1} className="min-w-0 outline-none">
            <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 lg:py-14">{children}</div>
          </main>
        </div>
        <EndFooter />
      </ViewTransition>
    </>
  );
}

// The nav only hints; every gated page checks again (lib/dal.ts).
async function SignedInNav() {
  const session = await getSession();
  if (!session) return null;
  const admin = can(session.user.role, { user: ["list"] });
  const guestbook = can(session.user.role, { guestbook: ["moderate"] });
  const items = [
    ...MINE,
    ...(admin ? ADMIN : []),
    ...(guestbook ? [{ href: "/admin/guestbook", label: "Guestbook" }] : []),
  ];
  return (
    <nav aria-label="Account" className="subnav">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <NavLinks items={items} />
      </div>
    </nav>
  );
}
