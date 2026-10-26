import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { postmarkDate, type Postcard, type PostcardSketch } from "./postcard.ts";

// The site's shared images, drawn by Satori: flex only, inline styles, the bundled Geist, no fetches. Every
// page's Open Graph card is a sheet of paper with its title inked on and a postmark rung with the build date
// (next.config.ts BUILD_DATE); a postcard (/postcard/image) is the same paper with a sketch on the left.

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

// The light paper and ink of app/(site)/globals.css; the postmark is --danger, the stamp pad's red.
const PAPER = "#f2efe7";
const FIELD = "#faf8f3";
const INK = "#231e16";
const MUTED = "#6b6456";
const LINE = "#ddd6c8";
const STAMP = "#b03a22";

// The build's day, as a postmark rings it: BUILD_DATE is YYYY-MM-DD; "dev" (no build) reads as such.
export function buildDate(value: string | undefined = process.env.BUILD_DATE): string {
  const ts = value ? Date.parse(`${value}T00:00:00Z`) : Number.NaN;
  return Number.isFinite(ts) ? postmarkDate(ts) : "DEV BUILD";
}

// The alt text of a page's card.
export const ogAlt = (title: string) => `${title}, stamped on paper by otohime.dev`;

// A round postmark: two rings in SVG with the wavy cancellation lines running off to the left, and the words
// set over it as text, since Satori draws an <svg> as an image and could not set its <text> in Geist.
function Postmark({ date, top, bottom }: { date: string; top: string; bottom: string }) {
  const waves = [0, 1, 2, 3].map((i) => {
    const y = 58 + i * 22;
    return `M0 ${y} q 20 -9 40 0 t 40 0 t 40 0 t 40 0`;
  });
  return (
    <div style={{ display: "flex", position: "relative", width: 340, height: 180, transform: "rotate(-8deg)" }}>
      <svg width="340" height="180" viewBox="0 0 340 180" style={{ position: "absolute", left: 0, top: 0 }}>
        {waves.map((d) => (
          <path key={d} d={d} fill="none" stroke={STAMP} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        ))}
        <circle cx="250" cy="90" r="84" fill="none" stroke={STAMP} strokeWidth="5" opacity="0.85" />
        <circle cx="250" cy="90" r="66" fill="none" stroke={STAMP} strokeWidth="2.5" opacity="0.8" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 166,
          top: 0,
          width: 168,
          height: 180,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: STAMP,
          opacity: 0.9,
        }}
      >
        <div style={{ display: "flex", fontSize: 15, letterSpacing: 3 }}>{top}</div>
        <div style={{ display: "flex", fontSize: 20, marginTop: 6, marginBottom: 6 }}>{date}</div>
        <div style={{ display: "flex", fontSize: 15, letterSpacing: 3 }}>{bottom}</div>
      </div>
    </div>
  );
}

// A hand-drawn rule: one slightly uneven stroke.
function Rule({ width }: { width: number }) {
  return (
    <svg width={width} height="12" viewBox={`0 0 ${width} 12`}>
      <path
        d={`M2 7 C ${width * 0.25} 3, ${width * 0.5} 10, ${width * 0.75} 5 S ${width - 4} 7, ${width - 2} 6`}
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Paper({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: PAPER,
        padding: 28,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          background: FIELD,
          border: `2px solid ${INK}`,
          boxShadow: `8px 8px 0 ${LINE}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// The title's size: long titles step down so two lines always fit.
const titleSize = (title: string) => (title.length > 28 ? 64 : title.length > 16 ? 84 : 112);

// A page's card: the title inked large, the path under it, the postmark top right.
export function pageCard({ title, path, date = buildDate() }: { title: string; path: string; date?: string }) {
  return (
    <Paper>
      <div style={{ position: "absolute", right: 36, top: 30, display: "flex" }}>
        <Postmark date={date} top="OTOHIME" bottom="POCKET POST" />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "56px 64px",
          color: INK,
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: MUTED, letterSpacing: 2 }}>OTOHIME.DEV</div>
        <div style={{ display: "flex", fontSize: titleSize(title), lineHeight: 1.05, marginTop: 12, maxWidth: 900 }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 18 }}>
          <Rule width={420} />
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 14 }}>{path}</div>
      </div>
    </Paper>
  );
}

// The ImageResponse for a page's opengraph-image file.
export function stamp(title: string, path: string): ImageResponse {
  return new ImageResponse(pageCard({ title, path }), { ...OG_SIZE });
}

// A postcard: the sketch on the left in an ink frame, the note on the right under a postmark rung with the
// day it was stamped. image is the sketch as a data URL (the route reads it from public/). The note is a
// JSX text child, so Satori sets it as text; it is never parsed as markup.
export function postcardCard({ postcard, sketch, image }: { postcard: Postcard; sketch: PostcardSketch; image: string }) {
  return (
    <Paper>
      <div style={{ display: "flex", width: 640, padding: 36, alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, next/image does not exist here */}
        <img
          src={image}
          alt=""
          width={568}
          height={500}
          style={{ objectFit: "cover", border: `3px solid ${INK}`, width: 568, height: 500 }}
        />
      </div>
      <div style={{ display: "flex", width: 2, margin: "40px 0", background: LINE }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "28px 36px 40px", color: INK }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginRight: -12 }}>
          <Postmark date={postmarkDate(postcard.ts)} top="OTOHIME" bottom={sketch.title.toUpperCase()} />
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            fontSize: postcard.note.length > 90 ? 30 : 36,
            lineHeight: 1.35,
            marginTop: 8,
            color: postcard.note ? INK : MUTED,
          }}
        >
          {postcard.note || "No words needed."}
        </div>
        <Rule width={400} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: MUTED, marginTop: 10 }}>
          <span>{sketch.title}</span>
          <span>otohime.dev/postcard</span>
        </div>
      </div>
    </Paper>
  );
}

export function postcardImage(
  props: { postcard: Postcard; sketch: PostcardSketch; image: string },
  headers?: Record<string, string>,
): ImageResponse {
  return new ImageResponse(postcardCard(props), { ...OG_SIZE, headers });
}
