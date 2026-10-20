import Link from "next/link";
import { TopBar } from "./_components/chrome";

// notFound() under the Orrery root layout (an unknown /orrery/<slug>) cannot
// reach the site's not-found page, so Orrery has its own, as Elements does.
export default function NotFound() {
  return (
    <div className="orrery">
      <TopBar />
      <main className="missing">
        <p className="missing-code">404</p>
        <h1>Nothing in this parcel</h1>
        <p>There&apos;s no body at this address.</p>
        <Link href="/orrery">The Orrery</Link>
      </main>
    </div>
  );
}
