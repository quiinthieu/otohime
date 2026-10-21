import Link from "next/link";
import { TopBar } from "./_components/chrome";

// notFound() under Structures' root layout (an unknown /structures/<slug>)
// cannot reach the site's not-found page, so the notebook has its own, as the
// Gazette does.
export default function NotFound() {
  return (
    <div className="notebook">
      <TopBar />
      <main className="missing">
        <p className="byline">404</p>
        <h1 className="title">Not in this series.</h1>
        <p>There is no page at this address.</p>
        <p>
          <Link href="/structures">Back to all eight pages</Link>
        </p>
      </main>
    </div>
  );
}
