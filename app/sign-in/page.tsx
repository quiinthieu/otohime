"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const fieldClass =
  "h-12 w-full bg-shell px-3 text-depth placeholder:text-mist";

export default function SignInPage() {
  const router = useRouter();
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

    if (result.error) {
      setMessage(result.error.message ?? "Could not sign in.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col justify-end px-6 pb-16 md:px-16 md:pb-24">
      <div className="w-full max-w-sm border-l border-tide pl-6 md:pl-8">
        <Link href="/" className="font-display text-3xl font-light text-depth">
          Otohime
        </Link>
        <h1 className="mt-8 text-2xl text-depth">
          {mode === "create" ? "Create account" : "Sign in"}
        </h1>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {mode === "create" ? (
            <label className="flex flex-col gap-2 text-sm text-mist">
              Name
              <input
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-2 text-sm text-mist">
            Email
            <input
              type="email"
              className={fieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-mist">
            Password
            <input
              type="password"
              className={fieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "create" ? "new-password" : "current-password"
              }
              minLength={8}
              required
            />
          </label>
          <button
            type="submit"
            className="mt-2 h-11 bg-depth text-sm text-shell"
          >
            {mode === "create" ? "Create account" : "Sign in"}
          </button>
        </form>
        {message ? (
          <p className="mt-4 text-sm text-depth" role="alert">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-6 text-left text-sm text-mist"
          onClick={() => {
            setMessage("");
            setMode((current) =>
              current === "sign-in" ? "create" : "sign-in",
            );
          }}
        >
          {mode === "create"
            ? "Already have an account? Sign in"
            : "Need an account? Create one"}
        </button>
      </div>
    </main>
  );
}
