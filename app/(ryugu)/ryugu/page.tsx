import { GhostLoader } from "@/ghosts/loader";
import type { Metadata } from "next";
import history from "@/content/history.json";
import { AmbienceToggle } from "../_components/ambience";
import { Sea } from "../_components/sea";
import { Tamatebako } from "../_components/tamatebako";
import { replay } from "../_lib/tamatebako";

// absolute: the layout's template would otherwise make this "Ryugu-jo · Ryugu-jo".
export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Ryugu-jo&path=%2Fryugu", width: 1200, height: 630, alt: "Ryugu-jo, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: { absolute: "Ryugu-jo" },
};

// /ryugu: the paper site's surface at the top, and below the waterline the ink sea with Otohime's palace on its floor
// and her Tamatebako, which replays the changelog built at build time (content/history.json, scripts/history-index.ts).
// The sea can be heard too, but only once the visitor asks for it.
export default function RyuguPage() {
  return (
    <main className="ryugu">
      <GhostLoader room="/ryugu" />
      <header className="surface">
        <nav className="ways-out" aria-label="Site">
          {/* A plain <a>: the site is another root layout, which needs a full page load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" data-surface="">
            <span aria-hidden="true">↑</span> Back to the surface
          </a>
        </nav>
        {/* Off until the visitor turns it on, here or in Pocket on the site (../_lib/ambience.ts). */}
        <AmbienceToggle />
        <svg className="waterline" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0H1000V10Q975 20 950 12T900 12T850 12T800 12T750 12T700 12T650 12T600 12T550 12T500 12T450 12T400 12T350 12T300 12T250 12T200 12T150 12T100 12T50 12T0 12Z" />
        </svg>
      </header>
      <Sea />
      <section className="palace-copy" aria-labelledby="ryugu-title">
        <p className="kicker">Below the waterline</p>
        <h1 id="ryugu-title">Ryugu-jo</h1>
        <p className="lead">
          Otohime&rsquo;s palace on the sea floor. Urashima Taro rode a turtle down here and stayed what felt like
          three days.
        </p>
        <p className="hint">Move your pointer, or touch the water, and the ink fish scatter.</p>
      </section>
      <Tamatebako replay={replay(history)} />
    </main>
  );
}
