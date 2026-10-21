import Link from "next/link";
import { MastheadLine, TopBar } from "./_components/masthead";

// notFound() under the Gazette's root layout (an unknown /articles/<slug>)
// cannot reach the site's not-found page, so the paper has its own, as Orrery does.
export default function NotFound() {
  return (
    <div className="gazette">
      <TopBar />
      <MastheadLine />
      <main className="missing">
        <p className="kicker">404</p>
        <h1 className="headline">Not in this edition.</h1>
        <p>There is no story at this address.</p>
        <p>
          <Link href="/articles">Back to the front page</Link>
        </p>
      </main>
    </div>
  );
}
