import { Notice } from "@/components/doodles";
import Link from "next/link";

export default function Forbidden() {
  return (
    <Notice page mood="worried" title="This room is locked">
      <p className="text-muted">Your role can&apos;t open it. Ask an admin if you need in.</p>
      <Link href="/" className="btn btn-primary mt-2">
        Go home
      </Link>
    </Notice>
  );
}
