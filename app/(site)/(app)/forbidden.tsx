import { Notice } from "@/components/figures";
import Link from "next/link";
import { ViewTransition } from "react";

export default function Forbidden() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <Notice n="403" title="This room is locked" figure="lock" color="coral">
        <meta name="robots" content="noindex" />
        <p className="text-muted">Your role can&apos;t open it. Ask an admin if you need in.</p>
        <Link href="/" className="btn btn-primary mt-2">
          Go home
        </Link>
      </Notice>
    </ViewTransition>
  );
}
