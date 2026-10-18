"use client";

import { Field } from "@/components/field";
import { FigTitle } from "@/components/figures";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isCreate = mode === "create";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    // Same-site paths only ("//x" and "/\x" leave the site); Better Auth
    // checks callbackURL again on the server.
    const raw = new URLSearchParams(location.search).get("next");
    const next = raw && /^\/(?![/\\])/.test(raw) ? raw : "/dashboard";
    setMessage("");
    setBusy(true);

    const result = isCreate
      ? await authClient.signUp.email({
          name: String(form.get("name")),
          email,
          password,
        })
      : await authClient.signIn.email({
          email,
          password,
          // unchecked: the session cookie ends when the browser closes
          rememberMe: form.get("remember") === "on",
          callbackURL: next,
        });

    if (result.error) {
      setBusy(false);
      setMessage(result.error.message ?? "Could not sign in.");
      return;
    }

    // Sign-in: Better Auth's client follows callbackURL with a full page load.
    if (isCreate) {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div>
      <FigTitle n="01">{isCreate ? "Create an account" : "Sign in"}</FigTitle>
      <p className="mt-2 text-muted">
        {isCreate
          ? "Pick a name, an email and a password."
          : "Type your email and password, then log in."}
      </p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {isCreate ? <Field label="Name" name="name" autoComplete="name" required /> : null}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@otohime.dev"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={isCreate ? "new-password" : "current-password"}
          minLength={8}
          hint={isCreate ? "At least 8 characters." : undefined}
          required
        />
        {isCreate ? null : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="check">
              <input type="checkbox" name="remember" defaultChecked />
              Remember me
            </label>
            <Link href="/forgot-password" className="link">
              Forgot password?
            </Link>
          </div>
        )}
        {message ? (
          <p role="alert" className="alert">
            {message}
          </p>
        ) : null}
        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? isCreate
                ? "Creating…"
                : "Signing in…"
              : isCreate
                ? "Create account"
                : "Log in"}
            {busy ? null : <span aria-hidden="true">→</span>}
          </button>
        </div>
      </form>
      <p className="mt-6 text-muted">
        {isCreate ? "Already have an account? " : "No account yet? "}
        <button
          type="button"
          className="link text-ink"
          onClick={() => {
            setMessage("");
            setMode(isCreate ? "sign-in" : "create");
          }}
        >
          {isCreate ? "Log in" : "Create one"}
        </button>
      </p>
    </div>
  );
}
