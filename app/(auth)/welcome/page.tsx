import { Doodle } from "@/components/doodles";
import Link from "next/link";

// Served at / for visitors without a session cookie (see proxy.ts).
export default function WelcomePage() {
  return (
    <>
      <h1 className="text-[2rem] sm:text-[2.5rem]">
        <span className="squiggle">Welcome</span> to the palace
      </h1>
      <p className="mt-2 text-muted">A personal place at otohime.dev.</p>
      <Link href="/sign-in" className="btn btn-primary mt-8 w-full">
        Sign in
        <Doodle name="arrow" className="wiggle" />
      </Link>
    </>
  );
}
