import { decodePostcard, postcardPaths, postmarkDate, sketchById } from "@/lib/postcard";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";

// A postcard is private to whoever holds its link: never indexed, never followed.
const robots = { index: false, follow: false } as const;

const codeOf = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export async function generateMetadata({ searchParams }: PageProps<"/postcard/view">): Promise<Metadata> {
  const code = codeOf((await searchParams).c);
  const postcard = decodePostcard(code);
  if (!code || !postcard) return { title: "A lost postcard", robots };
  const sketch = sketchById(postcard.sketch)!;
  const title = `A postcard: ${sketch.title}`;
  const description = postcard.note || `The ${sketch.title} sketch, sent from otohime.dev.`;
  const image = { url: postcardPaths(code).image, width: 1200, height: 630, alt: `A postcard of the ${sketch.title} sketch` };
  return {
    title,
    description,
    robots,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function PostcardViewPage({ searchParams }: PageProps<"/postcard/view">) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <Suspense fallback={<p className="text-muted">Opening the envelope…</p>}>
          <Postcard searchParams={searchParams} />
        </Suspense>
      </div>
    </ViewTransition>
  );
}

async function Postcard({ searchParams }: Pick<PageProps<"/postcard/view">, "searchParams">) {
  const postcard = decodePostcard(codeOf((await searchParams).c));
  if (!postcard) {
    return (
      <div>
        <h1>A lost postcard</h1>
        <p className="mt-2 max-w-prose text-muted">
          This one got smudged in the post: the link is cut short or was never a postcard.
        </p>
        <p className="mt-6">
          <Link href="/postcard" className="btn">
            Write a new one
          </Link>
        </p>
      </div>
    );
  }
  const sketch = sketchById(postcard.sketch)!;
  return (
    <article aria-labelledby="postcard-title">
      <h1 id="postcard-title">A postcard: {sketch.title}</h1>
      <div className="mt-6 grid gap-6 border border-ink bg-field p-4 sm:grid-cols-[3fr_2fr] sm:p-6">
        <Image src={sketch.src} alt={`The ${sketch.title} sketch`} width={1248} height={832} className="h-auto w-full border border-line" />
        <div className="flex flex-col gap-4">
          <p className="caption self-end rounded-full border-2 border-danger px-3 py-1 text-danger">
            <time dateTime={new Date(postcard.ts).toISOString()}>{postmarkDate(postcard.ts)}</time>
          </p>
          {/* A text child: React escapes the note, so it is never markup. */}
          <p className="text-lg whitespace-pre-wrap">{postcard.note || <span className="text-muted">No words needed.</span>}</p>
          <p className="mt-auto border-t border-line pt-2 text-muted">From the sketchbook at otohime.dev</p>
        </div>
      </div>
      <p className="mt-6 flex flex-wrap gap-3">
        <Link href={`/postcard?s=${postcard.sketch}`} className="btn">
          Send one back
        </Link>
        <Link href="/sketches" className="btn btn-ghost">
          See the sketchbook
        </Link>
      </p>
    </article>
  );
}
