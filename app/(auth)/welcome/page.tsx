import { FigTitle } from "@/components/figures";
import Link from "next/link";

// Served at / for visitors without a session cookie (see proxy.ts).
export default function WelcomePage() {
  return (
    <>
      <FigTitle n="01">Welcome</FigTitle>
      <p className="mt-2 text-muted">A personal place at otohime.dev. Sign in to come inside.</p>
      <Link href="/sign-in" className="btn btn-primary mt-6">
        Sign in <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}
