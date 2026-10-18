import { Notice } from "@/components/doodles";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Notice page mood="sleepy" title="This page drifted away">
        <p className="text-muted">Nothing lives at this address. Maybe the tide took it.</p>
        <Link href="/" className="btn btn-primary mt-2">
          Go home
        </Link>
      </Notice>
    </main>
  );
}
