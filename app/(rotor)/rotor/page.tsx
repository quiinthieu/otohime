import type { Metadata } from "next";
import { boxInk } from "../_components/box";
import { RotorApp } from "../_components/rotor-app";
import { EXPLAINER, EXPLAINER_TITLE, TAGLINE } from "../_lib/copy.ts";
import { parseSettings } from "../_lib/enigma.ts";
import { formQuery } from "../_lib/form.ts";
import { SOURCES } from "../_lib/wiring.ts";

// absolute: the layout's template would otherwise make this "Rotor · Rotor".
export const metadata: Metadata = { title: { absolute: "Rotor" } };

// The whole page depends on the query, and it must work with JavaScript off.
// Behind <Suspense> it would stream into a hidden <div> that only a script
// swaps in, so the page renders blocking instead: no static shell. (Next still
// serves it as a postponed prerender, so a redirect() here would be a
// client-side one; that is why a form submission is rendered, not redirected.)
export const instant = false;

// /rotor: the drawn Enigma (the island, server-rendered with the settings and
// message from the query), the explainer and the credit. A submitted lid form
// arrives with one field per slot (r=I&r=II&r=III…); formQuery joins it into
// the canonical shape, and the Share line shows the canonical URL.
export default async function RotorPage({ searchParams }: PageProps<"/rotor">) {
  const query = await searchParams;
  const { message, ...settings } = parseSettings(formQuery(query) ?? query);
  const { frame, rims, caps } = boxInk();

  return (
    <div className="rotor">
      <header className="topbar">
        <nav className="ways-out" aria-label="Site">
          {/* Plain <a>s: / and /projects are in another root layout, which needs a full page load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="home-link" href="/">
            otohime.dev
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="home-link" href="/projects">
            <span aria-hidden="true">←</span> All projects
          </a>
        </nav>
      </header>
      <main className="bench">
        <header className="title">
          <h1>Rotor</h1>
          <p className="tagline">{TAGLINE}</p>
        </header>
        <RotorApp settings={settings} message={message} frame={frame} rims={rims} caps={caps} />
        <section className="explainer" data-explainer="" aria-labelledby="how">
          <h2 id="how">{EXPLAINER_TITLE}</h2>
          {EXPLAINER.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      </main>
      <footer className="credit">
        <p>
          Wiring from <a href={SOURCES[0]}>Wikipedia&apos;s Enigma rotor details</a>, checked against{" "}
          <a href={SOURCES[1]}>the Crypto Museum&apos;s wiring tables</a>.
        </p>
      </footer>
    </div>
  );
}
