// Hand-drawn 24×24 doodles. Strokes use currentColor; fills come from fill-* classes.
export const doodlePaths = {
  wave: "M2 14c2.5-3 4.5-3 6.5 0s4.5 3 6.5 0 4.5-3 7 .5",
  bubble:
    "M12 4.4C16.3 4.3 19.7 7.9 19.6 12.1 19.5 16.3 16.1 19.7 11.9 19.6 7.7 19.5 4.3 16 4.4 11.8 4.5 7.7 8 4.3 13.2 4.7M8.4 10.2c.4-1.6 1.6-2.9 3.2-3.4",
  fish: "M7 12c2.5-4.5 9.5-6 14 0-4.5 6-11.5 4.5-14 0ZM7 12 3 8.5c.6 2.3.6 4.7 0 7ZM16.6 10.4h.01M12.5 9.6c.8 1.5.8 3.3 0 4.8",
  shell:
    "M5 17.5C3 11 6.5 4.5 12 4.5s9 6.5 7 13c-2.2 1.6-11.8 1.6-14 0ZM12 18.6V5.5M9 18.4 7.6 7.2M15 18.4l1.4-11.2M10 19.4h4l-.6 1.8h-2.8Z",
  star: "M12 3.5c.6 4.6 2.6 7.6 8 8.5-5.4.9-7.4 3.9-8 8.5-.6-4.6-2.6-7.6-8-8.5 5.4-.9 7.4-3.9 8-8.5Z",
  pearl:
    "M12 5.5c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7 3.1-7 7-7ZM8.8 11c.3-1.5 1.3-2.6 2.7-3M19.5 3v3M18 4.5h3",
  check: "M4.5 12.5c1.8 1.6 3.4 3.4 4.8 5.6C12 12.3 15.6 8 19.8 5.2",
  arrow: "M4 12.5c4.8-.6 10-.6 15.5-.3M14.5 7.5c1.8 1.7 3.4 3.2 5 4.7-1.7 1.4-3.3 3-4.8 4.8",
  menu: "M4 7c2.7-1 5.3 1 8 0s5.3-1 8 0M4 12c2.7-1 5.3 1 8 0s5.3-1 8 0M4 17c2.7-1 5.3 1 8 0s5.3-1 8 0",
  close: "M6 6.5c4 3.4 8 7.3 11.8 11.2M17.6 6.2c-3.6 3.6-7.4 7.6-11.4 11.6",
};

export type DoodleName = keyof typeof doodlePaths;

export function Doodle({
  name,
  className = "",
}: {
  name: DoodleName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={doodlePaths[name]} />
    </svg>
  );
}

export type Mood = "happy" | "sleepy" | "worried";

// A small sea turtle (Urashima Tarō's ride to the palace). Outline is
// currentColor: ink in light mode, a pearl die-cut edge in dark mode.
export function Mascot({
  mood = "happy",
  className = "",
}: {
  mood?: Mood;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 110"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`bob ${className}`}
    >
      <path className="fill-skin" d="M100 74c8 4 20 12 22 20-8 1-18-6-26-14Z" />
      <path className="fill-skin" d="M40 76c-8 5-18 8-24 6 3-7 12-12 22-13Z" />
      <path className="fill-skin" d="M104 52c6-2 10-2 14 0v14c-4 2-9 2-14 0Z" />
      <path
        className="fill-shell"
        d="M30 76C28 50 50 30 74 31c24 1 41 19 40 45-12 8-72 9-84 0Z"
      />
      <path d="M32.5 74C31 52 51 33.5 74 34.5" strokeWidth={1.5} opacity={0.45} />
      <path
        className="fill-skin"
        d="M128 37c8.5 0 15 6.5 15 15s-6.5 15-15 15-15-6.5-15-15 6.5-15 15-15Z"
      />
      <g className="stroke-navy">
        <path
          strokeWidth={2.5}
          d="M60 46l13-6 13 6-2 14H62ZM60 46l-12-4M86 46l12-4M62 60l-10 9M84 60l10 9"
        />
        {mood === "sleepy" ? (
          <path d="M129.5 48q3.5 3 7 0M133 58.5h4" />
        ) : (
          <>
            <circle cx="133" cy="48" r="3" className="fill-navy" stroke="none" />
            <circle cx="134.2" cy="46.8" r="1" className="fill-pearl" stroke="none" />
            <path
              d={
                mood === "worried"
                  ? "M128.5 41.5l7 2M131 59q2-2 4 0t4 0"
                  : "M131 56.5q4 4.5 8-.5"
              }
            />
          </>
        )}
      </g>
      <ellipse cx="124.5" cy="56" rx="3.5" ry="2.2" className="fill-coral" stroke="none" />
      {mood === "happy" ? (
        <path
          className="fill-gold"
          strokeWidth={2.5}
          transform="translate(138 4) scale(.8)"
          d={doodlePaths.star}
        />
      ) : null}
      {mood === "sleepy" ? (
        <path strokeWidth={2.5} d="M142 26h8l-8 9h8M152 12h6l-6 7h6" />
      ) : null}
      {mood === "worried" ? (
        <path
          className="fill-pearl"
          strokeWidth={2}
          d="M147 32c-3 4-4 7-1.5 8.5s4.5-1 1.5-8.5Z"
        />
      ) : null}
    </svg>
  );
}
