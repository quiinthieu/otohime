import { Notice } from "@/components/figures";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Notice n="404" title="Nothing in this parcel" figure="parcel">
        <p className="text-muted">There&apos;s no page at this address.</p>
        <Link href="/" className="btn btn-primary mt-2">
          Go home
        </Link>
      </Notice>
    </main>
  );
}
