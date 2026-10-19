import Link from "next/link";

// notFound() under the Elements root layout (an unknown /elements/<symbol>)
// cannot reach the site's not-found page, so Elements has its own.
export default function NotFound() {
  return (
    <main className="missing">
      <p className="missing-code">404</p>
      <h1>Nothing in this parcel</h1>
      <p>There&apos;s no element at this address.</p>
      <Link className="button" href="/elements">
        All elements
      </Link>
    </main>
  );
}
