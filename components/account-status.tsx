"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export function AccountStatus() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p className="text-sm text-mist">Checking session…</p>;
  }

  if (!session?.user) {
    return (
      <Link
        href="/sign-in"
        className="inline-flex h-11 items-center bg-depth px-5 text-sm text-shell"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-mist">Signed in as {session.user.email}</p>
      <button
        type="button"
        className="inline-flex h-11 items-center border border-tide px-5 text-sm text-depth"
        onClick={() => authClient.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
