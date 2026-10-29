import type { Stroke } from "@/lib/guestbook";

const colours = ["#231e16", "#ef6a4c", "#76a0e2"] as const;

export function GuestbookArt({ strokes, durationMs, replay = false }: { strokes: Stroke[]; durationMs: number; replay?: boolean }) {
  return (
    <svg viewBox="0 0 240 160" role="img" aria-label="Visitor ink drawing" className={replay ? "guestbook-art guestbook-replay" : "guestbook-art"}>
      <rect width="240" height="160" fill="var(--paper)" />
      {strokes.flatMap((stroke, index) => {
        const segments = [];
        for (let point = 1; point < stroke.w.length; point++) {
          const a = (point - 1) * 2;
          const b = point * 2;
          segments.push(
            <path key={`${index}-${point}`} d={`M${stroke.p[a]} ${stroke.p[a + 1]}L${stroke.p[b]} ${stroke.p[b + 1]}`}
              fill="none" stroke={colours[stroke.c]} strokeWidth={0.5 + 0.3 * stroke.w[point]}
              strokeLinecap="round" strokeLinejoin="round" pathLength="1"
              style={{ animationDelay: `${Math.min(2.3, (stroke.t0 + stroke.d * (point - 1) / Math.max(1, stroke.w.length - 1)) / Math.max(1, durationMs) * 2.3)}s` }} />,
          );
        }
        return segments;
      })}
    </svg>
  );
}
