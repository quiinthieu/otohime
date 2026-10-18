"use client";

import { BrandMark } from "@/components/brand-mark";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

function Arrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 8h9M8.5 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomePanel() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex flex-col items-center text-center">
        <BrandMark />
        <p className="mt-10 text-sm text-muted">Checking session…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center text-center">
        <BrandMark />
        <h1 className="mt-8 text-[2rem] leading-tight font-bold tracking-tight text-ink">
          Welcome.
        </h1>
        <p className="mt-2 text-sm text-muted">
          A personal place at otohime.dev.
        </p>
        <Link href="/sign-in" className="btn btn-primary mt-8 w-full">
          Sign in
          <Arrow />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <BrandMark />
      <h1 className="mt-8 text-[2rem] leading-tight font-bold tracking-tight text-ink">
        Welcome back!
      </h1>
      <p className="mt-2 text-sm text-muted">
        Signed in as {session.user.email}
      </p>
      <button
        type="button"
        className="btn w-full mt-8"
        onClick={() => authClient.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
