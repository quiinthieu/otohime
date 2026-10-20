import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BodyPoster } from "../../_components/body-poster";
import { Steps, TopBar } from "../../_components/chrome";
import { SunPoster } from "../../_components/sun-poster";
import { BODIES, bodyBySlug } from "../../_lib/bodies.ts";

// /orrery/<slug>: one body's poster. All fourteen are prerendered. An unknown
// slug renders in full at request time (ensureStatic, as Elements' pages do)
// and calls notFound(), which shows app/(orrery)/not-found.tsx with a 404.
// The Sun keeps its own pm-189 poster; every other body draws the generic one.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return BODIES.map((b) => ({ body: b.slug }));
}

export async function generateMetadata({ params }: PageProps<"/orrery/[body]">): Promise<Metadata> {
  const body = bodyBySlug((await params).body);
  return body ? { title: body.name } : {};
}

export default async function BodyPage({ params }: PageProps<"/orrery/[body]">) {
  const body = bodyBySlug((await params).body);
  if (!body) notFound();
  const steps = <Steps slug={body.slug} />;
  return (
    <div className="orrery">
      <TopBar />
      {body.slug === "sun" ? <SunPoster steps={steps} /> : <BodyPoster body={body} steps={steps} />}
    </div>
  );
}
