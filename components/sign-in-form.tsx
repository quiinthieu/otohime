"use client";

import { BrandMark } from "@/components/brand-mark";
import { Doodle } from "@/components/doodles";
import { Field } from "@/components/field";
import { authClient } from "@/lib/auth-client";
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
    setMessage("");
    setBusy(true);

    const result = isCreate
      ? await authClient.signUp.email({
          name: String(form.get("name")),
          email,
          password,
        })
      : await authClient.signIn.email({ email, password });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message ?? "Could not sign in.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <BrandMark />
      <h1 className="mt-8 text-[2rem] sm:text-[2.5rem]">
        {isCreate ? (
          <>
            Create an <span className="squiggle">account</span>
          </>
        ) : (
          <>
            Welcome <span className="squiggle">back</span>!
          </>
        )}
      </h1>
      <p className="mt-2 text-muted">
        {isCreate
          ? "A personal place at otohime.dev."
          : "Pick up where you left off, and keep things moving."}
      </p>
      <form onSubmit={onSubmit} className="mt-8 grid gap-4">
        {isCreate ? (
          <Field label="Name" name="name" autoComplete="name" required />
        ) : null}
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
        {message ? (
          <p role="alert" className="alert">
            {message}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary mt-2 w-full" disabled={busy}>
          {busy
            ? isCreate
              ? "Creating…"
              : "Signing in…"
            : isCreate
              ? "Create account"
              : "Log in"}
          {busy ? null : <Doodle name="arrow" className="wiggle" />}
        </button>
      </form>
      <p className="mt-6 text-muted">
        {isCreate ? "Already have an account? " : "Don't have an account? "}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMessage("");
            setMode(isCreate ? "sign-in" : "create");
          }}
        >
          {isCreate ? "Log in" : "Sign up"}
        </button>
      </p>
    </div>
  );
}
