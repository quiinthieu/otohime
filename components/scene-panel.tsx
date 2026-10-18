import { doodlePaths, Mascot, type DoodleName } from "@/components/doodles";

const swimmers: [DoodleName, string][] = [
  ["bubble", "translate(40 116) scale(1.3)"],
  ["bubble", "translate(300 250) scale(.9)"],
  ["bubble", "translate(62 300) scale(.7)"],
  ["fish", "translate(236 136) scale(1.9)"],
  ["fish", "translate(84 196) scale(-1.3 1.3)"],
];

// The Dragon Palace under the sea. Decorative: hidden from assistive tech.
export function ScenePanel() {
  return (
    <div
      aria-hidden="true"
      className="relative order-1 h-40 w-full shrink-0 self-stretch md:order-2 md:h-auto md:w-[46%] md:p-3 md:pl-0"
    >
      <div className="relative h-full min-h-40 overflow-hidden border-b-2 border-ink bg-linear-to-b from-scene-top to-scene-bottom text-ink md:rounded-[var(--wobble)] md:border-2">
        <svg
          viewBox="0 0 360 560"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 size-full"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M150 0 96 300M205 0 168 250M262 0 246 200"
            className="stroke-pearl/50"
            strokeWidth={6}
            strokeDasharray="2 14"
          />
          <path d="M0 72c30-14 60 14 90 0s60-14 90 0 60 14 90 0 60-14 90 0" />

          {/* vector-effect isn't inherited, so each scaled doodle sets it */}
          {swimmers.map(([name, transform]) => (
            <path
              key={transform}
              d={doodlePaths[name]}
              className={name === "fish" ? "fill-coral" : undefined}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              transform={transform}
            />
          ))}

          <path className="fill-pearl" d="M80 330h120v160H80Z" />
          <path className="fill-pearl" d="M104 250h72v60h-72Z" />
          <path
            className="fill-coral"
            d="M60 340c26 0 50-12 80-40 30 28 54 40 80 40-3 8-10 12-18 12H78c-8 0-15-4-18-12Z"
          />
          <path
            className="fill-coral"
            d="M88 262c20 0 38-10 52-30 14 20 32 30 52 30-2 7-8 10-14 10h-76c-6 0-12-3-14-10Z"
          />
          <path d="M140 232v-22" />
          <circle cx="140" cy="200" r="10" className="fill-pearl" />
          <path
            d={doodlePaths.star}
            className="fill-gold"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            transform="translate(152 166) scale(1.1)"
          />
          <path className="fill-navy" d="M124 490v-48a16 16 0 0 1 32 0v48Z" />
          <circle cx="104" cy="384" r="9" className="fill-navy" />
          <circle cx="176" cy="384" r="9" className="fill-navy" />

          <g className="stroke-sea" strokeWidth={4}>
            <path d="M30 560c-10-30 14-48 2-78s12-46 0-74" />
            <path d="M52 560c8-24-12-40-2-64s-10-36 0-58" />
            <path d="M330 560c10-28-14-44-2-72s-12-40 0-66" />
          </g>

          <path
            className="fill-surface"
            d="M0 478c40-14 80 12 120 0s80-14 120 0 80 12 120 0V560H0Z"
          />
          <path
            d={doodlePaths.shell}
            className="fill-coral"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            transform="translate(24 468) scale(1.3)"
          />
        </svg>
        <Mascot className="absolute right-3 bottom-1 w-28 md:right-[5%] md:bottom-[12%] md:w-[52%] md:max-w-56" />
      </div>
    </div>
  );
}
