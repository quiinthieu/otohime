import { RisoText } from "@/components/riso-heading";
import {
  PasswordForm,
  ProfileForm,
  RevokeOthersButton,
  RevokeSessionButton,
} from "@/components/account-panel";
import { FigTitle } from "@/components/figures";
import { SessionList } from "@/components/session-list";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/dal";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ViewTransition } from "react";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Account&path=%2Faccount", width: 1200, height: 630, alt: "Account, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "Account",
};

export default async function AccountPage() {
  const { user, session } = await requireUser("/account");
  // Better Auth only lists sessions for a session younger than a day.
  const sessions = await auth.api.listSessions({ headers: await headers() }).catch(() => null);

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise grid gap-6">
        <FigTitle n="09" hint={user.email}>
          Account
        </FigTitle>
        <section className="card grid gap-4 p-5">
          <h2 className="caption"><RisoText>Profile</RisoText></h2>
          <ProfileForm name={user.name} />
        </section>
        <section className="card grid gap-4 p-5">
          <h2 className="caption"><RisoText>Password</RisoText></h2>
          <PasswordForm />
        </section>
        <section className="card grid gap-4 p-5">
          <h2 className="caption"><RisoText>Sessions</RisoText></h2>
          {sessions ? (
            <SessionList
              sessions={sessions}
              empty="Only this device is signed in."
              action={(s) =>
                s.id === session.id ? (
                  <span className="badge" data-tone="ok">
                    This device
                  </span>
                ) : (
                  <RevokeSessionButton token={s.token} />
                )
              }
            />
          ) : (
            <p className="text-muted">Sign in again to see your devices.</p>
          )}
          <RevokeOthersButton />
        </section>
      </div>
    </ViewTransition>
  );
}
