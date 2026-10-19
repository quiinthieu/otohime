import { Notice } from "@/components/figures";
import Link from "next/link";

export default function Forbidden() {
  return (
    <Notice n="403" title="This room is locked" figure="lock" color="coral">
      <p className="text-muted">Your role can&apos;t open it. Ask an admin if you need in.</p>
      <Link href="/" className="btn btn-primary mt-2">
        Go home
      </Link>
    </Notice>
  );
}
