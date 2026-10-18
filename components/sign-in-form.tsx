"use client";

import { BrandMark } from "@/components/brand-mark";
import { Doodle } from "@/components/doodles";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    const result =
      mode === "create"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message ?? "Could not sign in.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  const isCreate = mode === "create";

  return (
    <div className="flex flex-col items-center text-center">
      <BrandMark />
      <h1 className="mt-8 text-[2rem] leading-tight font-bold tracking-tight text-ink">
        {isCreate ? "Create an account" : "Welcome back!"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {isCreate
          ? "A personal place at otohime.dev."
          : "Pick up where you left off, and keep things moving."}
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-8 flex w-full flex-col gap-3 text-left"
      >
        {isCreate ? (
          <div>
            <label htmlFor="name" className="sr-only">
              Name
            </label>
            <input
              id="name"
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Your name"
              required
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@otohime.dev"
            required
          />
        </div>
        <div className="relative">
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            type={visible ? "text" : "password"}
            className="field pr-16"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isCreate ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          <button
            type="button"
            className="reveal"
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        <button type="submit" className="btn btn-primary w-full mt-2" disabled={busy}>
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
      {message ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {message}
        </p>
      ) : null}
      <p className="mt-6 text-sm text-muted">
        {isCreate ? "Already have an account? " : "Don't have an account? "}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMessage("");
            setMode((current) =>
              current === "sign-in" ? "create" : "sign-in",
            );
          }}
        >
          {isCreate ? "Log in" : "Sign up"}
        </button>
      </p>
    </div>
  );
}
