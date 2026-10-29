import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BohrSvg } from "../../_components/bohr-svg";
import { ElementDetail } from "../../_components/element-detail";
import { ELEMENTS } from "../../_lib/elements.ts";
import { slug } from "../../_lib/format.ts";

// /elements/<symbol>: one element on its own page, the no-JS path and the
// shareable link. All 118 are prerendered. An unknown symbol renders in full at
// request time (ensureStatic, as the site's catch-all does) and calls
// notFound(), which shows app/(elements)/not-found.tsx with a 404.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return ELEMENTS.map((el) => ({ symbol: slug(el) }));
}

const find = (symbol: string) => ELEMENTS.find((el) => slug(el) === symbol.toLowerCase());

export async function generateMetadata({ params }: PageProps<"/elements/[symbol]">): Promise<Metadata> {
  const el = find((await params).symbol);
  return el ? {
    title: `${el.name} (${el.symbol})`,
    openGraph: {
      images: [{ url: `/og?${new URLSearchParams({ title: `${el.name} (${el.symbol})`, path: `/elements/${slug(el)}` })}`, width: 1200, height: 630, alt: `${el.name} (${el.symbol}), stamped on paper by otohime.dev` }],
    },
    twitter: { card: "summary_large_image" },
  } : {};
}

export default async function ElementPage({ params }: PageProps<"/elements/[symbol]">) {
  const el = find((await params).symbol);
  if (!el) notFound();
  const prev = ELEMENTS[el.number - 2];
  const next = ELEMENTS[el.number];
  return (
    <div className="elements">
      <header className="topbar">
        <Link className="home-link" href="/elements">
          ← All elements
        </Link>
      </header>
      <main className="element-page">
        <ElementDetail el={el} Heading="h1" viewport={<BohrSvg el={el} />} />
        <nav className="dialog-steps" aria-label="Other elements">
          {prev ? (
            <Link className="button" href={`/elements/${slug(prev)}`}>
              <span aria-hidden="true">←</span> Previous <span className="step-name">{prev.name}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link className="button" href={`/elements/${slug(next)}`}>
              Next <span aria-hidden="true">→</span> <span className="step-name">{next.name}</span>
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
