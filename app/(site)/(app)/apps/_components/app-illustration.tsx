import Image from "next/image";
import { type CSSProperties } from "react";
import { box, Inked, swatches, type Point } from "@/components/figures";
import { hashAppSlug, type AppIllustration as AppIllustrationSpec, type AppMotif, type AppSwatch } from "@/lib/apps";

function BentoBoxArt() {
  const outer = box([182, 146], 124, 96, 30);
  const cellA = box([182, 146], 52, 38, 22, [8, 8, 12], 10);
  const cellB = box([182, 146], 52, 38, 26, [64, 8, 12], 12);
  const cellC = box([182, 146], 52, 38, 20, [8, 50, 12], 10);
  const cellD = box([182, 146], 52, 38, 24, [64, 50, 12], 10);

  return (
    <>
      <polygon className="fig-shade" points={outer.shadow} />
      <polygon className="fig-top" points={outer.top} />
      <polygon className="fig-shaded" points={outer.shaded} />
      <polygon className="fig-lit" points={outer.lit} />
      <polygon className="fig-inside" points={outer.poly([[6, 6, 30], [118, 6, 30], [118, 90, 30], [6, 90, 30]])} />

      {[cellA, cellB, cellC, cellD].map((cell, idx) => (
        <g key={idx}>
          <polygon className={idx % 2 === 0 ? "fig-paper" : "fig-top"} points={cell.top} />
          <polygon className="fig-shaded" points={cell.shaded} />
          <polygon className={idx === 1 ? "fig-lit" : "fig-tape"} points={cell.lit} />
        </g>
      ))}

      {/* Inner bento dividers */}
      <polyline fill="none" points={outer.poly([[62, 6, 31], [62, 90, 31]])} />
      <polyline fill="none" points={outer.poly([[6, 48, 31], [118, 48, 31]])} />

      {/* Token budget meter along front lip */}
      <polygon className="fig-paper" points={outer.poly([[124, 14, 9], [124, 82, 9], [124, 82, 21], [124, 14, 21]])} />
      <polygon className="fig-ink" points={outer.poly([[124, 16, 11], [124, 58, 11], [124, 58, 19], [124, 16, 19]])} />
    </>
  );
}

function BonsaiGardenArt() {
  const tray = box([182, 158], 122, 86, 20);
  const lanternBase = box([182, 158], 20, 20, 10, [86, 52, 20], 8);
  const lanternBox = box([182, 158], 16, 16, 14, [88, 54, 30], 10);
  const lanternRoof = box([182, 158], 24, 24, 7, [84, 50, 44], 8);
  const canopyLow = box([182, 158], 44, 34, 13, [22, 26, 48], 12);
  const canopyHigh = box([182, 158], 36, 28, 14, [30, 18, 66], 14);
  const trunk: Point[] = [
    [44, 44, 20],
    [40, 40, 38],
    [45, 34, 54],
    [48, 31, 68],
  ];

  return (
    <>
      <polygon className="fig-shade" points={tray.shadow} />
      <polygon className="fig-shaded" points={tray.shaded} />
      <polygon className="fig-dark" points={tray.lit} />
      <polygon className="fig-floor" points={tray.top} />

      {/* Moss bed & stepping stones */}
      <polygon className="fig-lit" points={tray.poly([[10, 10, 21], [78, 12, 21], [74, 72, 21], [12, 74, 21]])} />
      <polygon className="fig-paper" points={tray.poly([[80, 18, 21], [96, 18, 21], [96, 30, 21], [80, 30, 21]])} />
      <polygon className="fig-paper" points={tray.poly([[92, 34, 21], [108, 34, 21], [108, 44, 21], [92, 44, 21]])} />

      {/* Bonsai trunk & foliage pads */}
      <path d={`M${trunk.map(tray.p).join("L")}`} fill="none" strokeWidth={5.5} />
      <polygon className="fig-top" points={canopyLow.top} />
      <polygon className="fig-shaded" points={canopyLow.shaded} />
      <polygon className="fig-lit" points={canopyLow.lit} />
      <polygon className="fig-top" points={canopyHigh.top} />
      <polygon className="fig-shaded" points={canopyHigh.shaded} />
      <polygon className="fig-lit" points={canopyHigh.lit} />

      {/* Courtyard stone lantern */}
      {[lanternBase, lanternBox, lanternRoof].map((part, idx) => (
        <g key={idx}>
          <polygon className={idx === 1 ? "fig-paper" : "fig-tape"} points={part.top} />
          <polygon className="fig-shaded" points={part.shaded} />
          <polygon className={idx === 1 ? "fig-lamp" : "fig-tape"} points={part.lit} />
        </g>
      ))}
    </>
  );
}

function LedgerBookArt() {
  const cover = box([180, 152], 132, 94, 14);
  const leftPage = box([180, 152], 60, 82, 7, [6, 6, 14], 4);
  const rightPage = box([180, 152], 60, 82, 7, [66, 6, 14], 4);
  const barHeights = [26, 19, 14, 10];

  return (
    <>
      <polygon className="fig-shade" points={cover.shadow} />
      <polygon className="fig-dark" points={cover.top} />
      <polygon className="fig-shaded" points={cover.shaded} />
      <polygon className="fig-dark" points={cover.lit} />

      {/* Open left & right paper spreads */}
      <polygon className="fig-paper" points={leftPage.top} />
      <polygon className="fig-tape" points={leftPage.shaded} />
      <polygon className="fig-tape" points={leftPage.lit} />

      <polygon className="fig-paper" points={rightPage.top} />
      <polygon className="fig-tape" points={rightPage.shaded} />
      <polygon className="fig-tape" points={rightPage.lit} />

      {/* Ruled ledger lines on left page */}
      {[18, 30, 42, 54, 66].map((y) => (
        <polyline key={y} fill="none" strokeWidth={1.5} points={cover.poly([[14, y, 22], [58, y, 22]])} />
      ))}

      {/* Four token spend columns on right page */}
      {barHeights.map((height, idx) => {
        const bar = box([180, 152], 10, 12, height, [74 + idx * 13, 46, 21], 6);
        return (
          <g key={idx}>
            <polygon className="fig-top" points={bar.top} />
            <polygon className="fig-shaded" points={bar.shaded} />
            <polygon className="fig-lit" points={bar.lit} />
          </g>
        );
      })}

      {/* Bookmark ribbon */}
      <polygon className="fig-lamp" points={cover.poly([[63, 88, 21], [69, 88, 21], [72, 106, 6], [60, 106, 6]])} />
    </>
  );
}

function SunDialArt() {
  const plinth = box([182, 158], 116, 92, 18);
  const dialRing = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    return [58 + Math.cos(angle) * 38, 46 + Math.sin(angle) * 30, 19] as Point;
  });
  const solarArc = Array.from({ length: 17 }, (_, i) => {
    const t = (i / 16) * Math.PI;
    return [58 - Math.cos(t) * 44, 46, 22 + Math.sin(t) * 52] as Point;
  });
  const sunDisc = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    return [34 + Math.cos(angle) * 8, 46 + Math.sin(angle) * 6, 64 + Math.sin(angle) * 6] as Point;
  });

  return (
    <>
      <polygon className="fig-shade" points={plinth.shadow} />
      <polygon className="fig-paper" points={plinth.top} />
      <polygon className="fig-shaded" points={plinth.shaded} />
      <polygon className="fig-lit" points={plinth.lit} />

      {/* Seasonal compass ring */}
      <polygon className="fig-floor" points={plinth.poly(dialRing)} />
      <polyline fill="none" points={plinth.poly([[20, 46, 19], [96, 46, 19]])} />
      <polyline fill="none" points={plinth.poly([[58, 16, 19], [58, 76, 19]])} />

      {/* Gnomon & cast shadow */}
      <polygon className="fig-shade" points={plinth.poly([[58, 46, 19], [86, 64, 19], [74, 70, 19]])} />
      <polygon className="fig-lit" points={plinth.poly([[58, 46, 19], [58, 26, 19], [58, 46, 52]])} />

      {/* Solar elevation arc & sun */}
      <polyline fill="none" strokeDasharray="4 4" points={plinth.poly(solarArc)} />
      <polygon className="fig-top" points={plinth.poly(sunDisc)} />
    </>
  );
}

function BlueprintFallbackArt({ seed }: { seed: number }) {
  const sheet = box([182, 160], 124, 92, 12);
  const h1 = 18 + (seed % 20);
  const h2 = 24 + ((seed >>> 5) % 24);
  const h3 = 14 + ((seed >>> 10) % 18);
  const blockA = box([182, 160], 32, 30, h1, [16, 18, 12], 10);
  const blockB = box([182, 160], 34, 30, h2, [54, 18, 12], 12);
  const blockC = box([182, 160], 56, 24, h3, [34, 54, 12], 8);

  return (
    <>
      <polygon className="fig-shade" points={sheet.shadow} />
      <polygon className="fig-paper" points={sheet.top} />
      <polygon className="fig-shaded" points={sheet.shaded} />
      <polygon className="fig-tape" points={sheet.lit} />

      {[30, 60, 90].map((x) => (
        <polyline key={x} fill="none" strokeWidth={1.1} points={sheet.poly([[x, 8, 13], [x, 84, 13]])} />
      ))}
      {[28, 56].map((y) => (
        <polyline key={y} fill="none" strokeWidth={1.1} points={sheet.poly([[10, y, 13], [114, y, 13]])} />
      ))}

      {[blockA, blockB, blockC].map((part, idx) => (
        <g key={idx}>
          <polygon className="fig-top" points={part.top} />
          <polygon className="fig-shaded" points={part.shaded} />
          <polygon className={idx === 1 ? "fig-lit" : "fig-paper"} points={part.lit} />
        </g>
      ))}
    </>
  );
}

function MotifArtwork({ motif, seed }: { motif: AppMotif; seed: number }) {
  switch (motif) {
    case "bento-box":
      return <BentoBoxArt />;
    case "bonsai-garden":
      return <BonsaiGardenArt />;
    case "ledger-book":
      return <LedgerBookArt />;
    case "sun-dial":
      return <SunDialArt />;
    case "blueprint":
      return <BlueprintFallbackArt seed={seed} />;
  }
}

export function AppIllustration({
  slug,
  swatch,
  illustration,
  compact = false,
  className = "",
}: {
  slug: string;
  swatch: AppSwatch;
  illustration: AppIllustrationSpec;
  compact?: boolean;
  className?: string;
}) {
  const seed = hashAppSlug(slug);
  const motif: AppMotif = illustration.kind === "ink" ? (illustration.motif ?? "blueprint") : "blueprint";

  return (
    <figure
      className={`app-illustration ${compact ? "app-illustration-compact" : ""} ${className}`.trim()}
      data-illustration-kind={illustration.kind}
      data-illustration-motif={illustration.kind === "ink" ? motif : undefined}
    >
      {illustration.kind === "screenshot" ? (
        <div className="app-illustration-art">
          <Image
            src={illustration.src}
            alt={illustration.alt}
            width={illustration.width}
            height={illustration.height}
            className="app-screenshot-img"
            unoptimized
          />
        </div>
      ) : (
        <div className="app-illustration-art" role="img" aria-label={illustration.alt}>
          <Inked
            viewBox="0 0 360 220"
            seed={seed % 997}
            className="app-illustration-svg"
            style={{ "--fig": swatches[swatch] } as CSSProperties}
          >
            <MotifArtwork motif={motif} seed={seed} />
          </Inked>
        </div>
      )}
      {!compact && illustration.caption ? (
        <figcaption className="caption app-illustration-caption">{illustration.caption}</figcaption>
      ) : null}
    </figure>
  );
}
