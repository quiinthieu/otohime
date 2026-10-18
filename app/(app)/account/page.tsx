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

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user, session } = await requireUser("/account");
  // Better Auth only lists sessions for a session younger than a day.
  const sessions = await auth.api.listSessions({ headers: await headers() }).catch(() => null);

  return (
    <div className="rise grid gap-6">
      <FigTitle n="06" hint={user.email}>
        Account
      </FigTitle>
      <section className="card grid gap-4 p-5">
        <h2 className="caption">Profile</h2>
        <ProfileForm name={user.name} />
      </section>
      <section className="card grid gap-4 p-5">
        <h2 className="caption">Password</h2>
        <PasswordForm />
      </section>
      <section className="card grid gap-4 p-5">
        <h2 className="caption">Sessions</h2>
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
  );
}
