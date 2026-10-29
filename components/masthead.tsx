import { BrandMark } from "@/components/brand-mark";
import { SignOutButton, StopImpersonatingButton } from "@/components/nav-links";
import { SeasonDial } from "@/components/season-dial";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlotterToggle } from "@/components/plotter-toggle";
import { site } from "@/content/site";
import { getSession } from "@/lib/dal";
import Link from "next/link";
import { Suspense } from "react";

// The chrome every layout shares: a skip link, the sticky masthead and the
// impersonation banner. It prerenders; anything that reads the session
// streams in behind its own boundary.
export function Masthead() {
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
          <PlotterToggle />
          <SoundToggle label={site.sound.label} />
          <SeasonDial />
          <ThemeToggle />
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
