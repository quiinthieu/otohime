"use client";

import { Field } from "@/components/field";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Result = { error: { message?: string } | null };

// Busy flag plus one status line (an error, or what just happened).
function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: () => Promise<Result>, done: string) {
    setBusy(true);
    setStatus(null);
    const { error } = await action();
    setBusy(false);
    setStatus(error ? { ok: false, text: error.message ?? "That didn't work." } : { ok: true, text: done });
    if (!error) router.refresh();
    return !error;
  }

  const line = status ? (
    <p role={status.ok ? "status" : "alert"} className="alert" data-tone={status.ok ? "ok" : undefined}>
      {status.text}
    </p>
  ) : null;

  return { busy, run, line };
}

export function ProfileForm({ name }: { name: string }) {
  const { busy, run, line } = useAction();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("name")).trim();
    run(() => authClient.updateUser({ name: next }), "Name saved.");
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <Field label="Name" name="name" defaultValue={name} autoComplete="name" required />
      {line}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Save name
        </button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { busy, run, line } = useAction();
  const [mismatch, setMismatch] = useState(false);

  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("new"));
    const differs = newPassword !== data.get("confirm");
    setMismatch(differs);
    if (differs) return;
    const ok = await run(
      () =>
        authClient.changePassword({
          currentPassword: String(data.get("current")),
          newPassword,
          revokeOtherSessions: true,
        }),
      "Password changed. Your other devices are signed out.",
    );
    if (ok) form.reset();
  }

  return (
    <form onSubmit={change} className="grid gap-4">
      <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Field
        label="New password"
        name="new"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="At least 8 characters."
        required
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={mismatch ? "The two passwords don't match." : undefined}
        required
      />
      {line}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Change password
        </button>
      </div>
    </form>
  );
}

export function RevokeSessionButton({ token }: { token: string }) {
  const { busy, run, line } = useAction();
  return (
    <>
      {line}
      <button
        type="button"
        className="btn btn-sm"
        disabled={busy}
        onClick={() => run(() => authClient.revokeSession({ token }), "Signed out.")}
      >
        Revoke
      </button>
    </>
  );
}

export function RevokeOthersButton() {
  const { busy, run, line } = useAction();
  return (
    <div className="grid justify-items-start gap-3">
      {line}
      <button
        type="button"
        className="btn btn-sm"
        disabled={busy}
        onClick={() => run(() => authClient.revokeOtherSessions(), "Every other device is signed out.")}
      >
        Sign out everywhere else
      </button>
    </div>
  );
}
