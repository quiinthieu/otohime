"use client";

import { Field } from "@/components/field";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setBusy(true);
    setMessage("");
    // Better Auth answers the same whether or not the account exists.
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    if (error) setMessage(error.message ?? "Could not send the link.");
    else setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="alert" data-tone="ok">
        If an account uses that email, a reset link is on its way. It works for an hour.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      {message ? (
        <p role="alert" className="alert">
          {message}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </div>
    </form>
  );
}

// The emailed link lands here as ?token=… (or ?error=INVALID_TOKEN).
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("new"));
    const differs = newPassword !== data.get("confirm");
    setMismatch(differs);
    if (differs || !token) return;
    setBusy(true);
    setMessage("");
    const { error } = await authClient.resetPassword({ newPassword, token });
    setBusy(false);
    if (error) setMessage(error.message ?? "Could not change the password.");
    else setDone(true);
  }

  if (!token || params.has("error")) {
    return (
      <p className="alert">
        This reset link is invalid or has expired.{" "}
        <Link href="/forgot-password" className="link">
          Ask for a new one
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <div className="grid justify-items-start gap-4">
        <p role="status" className="alert" data-tone="ok">
          Password changed. Every device was signed out.
        </p>
        <Link href="/sign-in" className="btn btn-primary">
          Sign in <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
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
      {message ? (
        <p role="alert" className="alert">
          {message}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </div>
    </form>
  );
}
