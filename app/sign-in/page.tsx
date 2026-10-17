"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const result =
      mode === "create"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    setMessage(result.error?.message ?? "Signed in.");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-24">
      <Link href="/" className="text-sm text-zinc-500">
        Otohime
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {mode === "create" ? "Create account" : "Sign in"}
      </h1>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        {mode === "create" ? (
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              className="h-11 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            className="h-11 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            className="h-11 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <button
          type="submit"
          className="mt-2 h-11 rounded-full bg-foreground text-sm font-medium text-background"
        >
          {mode === "create" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        className="mt-4 text-left text-sm text-zinc-500"
        onClick={() =>
          setMode((current) => (current === "sign-in" ? "create" : "sign-in"))
        }
      >
        {mode === "create"
          ? "Already have an account? Sign in"
          : "Need an account? Create one"}
      </button>
      {message ? <p className="mt-4 text-sm">{message}</p> : null}
    </main>
  );
}
