"use client";

import { authClient } from "@/lib/auth-client";
import type { RoleName } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type Target = { id: string; name: string; role: string; banned: boolean; banReason?: string | null };

// Every action is a Better Auth admin endpoint: the server checks the
// permission and, in lib/auth.ts, the role hierarchy. The UI only hides.
export function UserActions({
  user,
  assignable,
  sessions,
}: {
  user: Target;
  assignable: RoleName[];
  sessions: React.ReactNode;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(action: () => Promise<{ error: { message?: string } | null }>) {
    setBusy(true);
    setMessage("");
    const { error } = await action();
    setBusy(false);
    if (error) setMessage(error.message ?? "That didn't work.");
    return !error;
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const role = new FormData(event.currentTarget).get("role") as RoleName;
    if (await run(() => authClient.admin.setRole({ userId: user.id, role }))) router.refresh();
  }

  async function ban(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (await run(() => authClient.admin.banUser({ userId: user.id, banReason: reason || undefined }))) {
      router.refresh();
    }
  }

  return (
    <div className="grid gap-5">
      {message ? (
        <p role="alert" className="alert">
          {message}
        </p>
      ) : null}
      <div>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            if (await run(() => authClient.admin.impersonateUser({ userId: user.id }))) {
              router.push("/");
              router.refresh();
            }
          }}
        >
          Impersonate
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {assignable.length > 1 ? (
          <form onSubmit={saveRole} className="card grid content-start gap-3 p-5">
            <h2 id="role-heading" className="caption">
              Role
            </h2>
            <select
              name="role"
              aria-labelledby="role-heading"
              className="field"
              defaultValue={user.role}
            >
              {assignable.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm w-fit" disabled={busy}>
              Save role
            </button>
          </form>
        ) : null}
        <section className={`card grid content-start gap-3 p-5 ${assignable.length > 1 ? "" : "lg:col-span-2"}`}>
          <h2 className="caption">Access</h2>
          {user.banned ? (
            <>
              <p className="alert">Banned{user.banReason ? `: ${user.banReason}` : "."}</p>
              <button
                type="button"
                className="btn btn-sm w-fit"
                disabled={busy}
                onClick={async () => {
                  if (await run(() => authClient.admin.unbanUser({ userId: user.id }))) {
                    router.refresh();
                  }
                }}
              >
                Unban
              </button>
            </>
          ) : (
            <form onSubmit={ban} className="grid gap-3">
              <div>
                <label htmlFor="ban-reason" className="label">
                  Reason (optional)
                </label>
                <textarea id="ban-reason" name="reason" rows={2} className="field" />
                <p className="hint">Banning signs them out everywhere and blocks sign-in.</p>
              </div>
              <button type="submit" className="btn btn-danger btn-sm w-fit" disabled={busy}>
                Ban user
              </button>
            </form>
          )}
        </section>
        <section className="card grid gap-3 p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="caption">Sessions</h2>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={async () => {
                if (await run(() => authClient.admin.revokeUserSessions({ userId: user.id }))) {
                  router.refresh();
                }
              }}
            >
              Revoke all
            </button>
          </div>
          {sessions}
        </section>
        <section className="card grid gap-3 border-danger p-5 lg:col-span-2">
          <h2 className="caption">Danger zone</h2>
          <p className="text-muted">Deleting removes their account and every session. It can&apos;t be undone.</p>
          <button
            type="button"
            className="btn btn-danger btn-sm w-fit"
            onClick={() => dialog.current?.showModal()}
          >
            Delete user…
          </button>
          <dialog ref={dialog} className="dialog" aria-labelledby="delete-title">
            <h2 id="delete-title" className="font-semibold">
              Delete {user.name}?
            </h2>
            <p className="mt-2 text-muted">Their account and sessions go away for good.</p>
            <form method="dialog" className="mt-5 flex flex-wrap justify-end gap-3">
              {/* Focus lands on the safe choice when the dialog opens. */}
              <button className="btn" autoFocus>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() => authClient.admin.removeUser({ userId: user.id }));
                  dialog.current?.close();
                  if (ok) {
                    router.push("/admin/users");
                    router.refresh();
                  }
                }}
              >
                Delete user
              </button>
            </form>
          </dialog>
        </section>
      </div>
    </div>
  );
}
