"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export function AccountStatus() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p className="text-sm text-zinc-500">Checking session…</p>;
  }

  if (!session?.user) {
    return (
      <Link
        href="/sign-in"
        className="inline-flex h-11 w-fit items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as {session.user.email}
      </p>
      <button
        type="button"
        className="inline-flex h-11 items-center rounded-full border border-zinc-300 px-5 text-sm dark:border-zinc-700"
        onClick={() => authClient.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
