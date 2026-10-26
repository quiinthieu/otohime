import { DEPTHS, NEUTRAL, projectLayer } from "@/lib/peep-box";

/** Server-only print: all shapes, dimensions and neutral projections survive without JS. */
export function PeepBoxScene() {
  const layers = [
    <g
      key="palace"
      fill="var(--paper-2)"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinejoin="round"
    >
      <path
        fill="var(--blue)"
        opacity=".22"
        stroke="none"
        d="M-400-300H1000V700H-400z"
      />
      <path d="M180 330V138H420V330M220 140V70H380V140" />
      <path
        fill="var(--coral)"
        d="M145 144Q190 120 210 100L300 126 390 100Q413 126 455 144ZM196 74Q240 50 251 25L300 45 350 25Q365 53 404 74Z"
      />
      <path fill="var(--shade)" d="M270 330V238Q300 202 330 238V330" />
      <path
        d="M200 173H400M230 173V207M370 173V207M262 96H337M300 75V115"
        fill="none"
      />
      <path
        d="M70 285Q300 245 530 285M20 355Q280 305 580 350"
        fill="none"
        opacity=".4"
      />
    </g>,
    <g
      key="garden"
      stroke="var(--ink)"
      strokeWidth="2.5"
      strokeLinejoin="round"
    >
      <path
        fill="var(--mint)"
        d="M-120 480Q-10 275 130 312T360 330T740 290V600H-120Z"
      />
      {[65, 140, 465, 540].map((x, i) => (
        <g
          key={x}
          transform={`translate(${x} ${(i % 2) * 30})`}
          fill="var(--mint)"
        >
          <path d="M0 350Q-40 280 0 215T0 110Q46 148 20 211T12 350Z" />
          <path
            d="M8 330Q-20 270 8 200M8 260Q45 227 38 200M2 216Q-30 192-26 166"
            fill="none"
          />
        </g>
      ))}
      <path d="M180 343l16-18 18 18m160-8 15-22 24 24" fill="var(--paper)" />
    </g>,
    <g key="fish" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round">
      {[
        [185, 145],
        [410, 185],
        [310, 95],
      ].map(([x, y], i) => (
        <g
          key={x}
          transform={`translate(${x} ${y}) scale(${i === 1 ? -1 : 1} 1)`}
        >
          <path
            fill={i === 2 ? "var(--yellow)" : "var(--coral)"}
            d="M-28 0Q0-26 28 0Q0 26-28 0L-46-15V15Z"
          />
          <circle cx="15" cy="-2" r="2" fill="var(--ink)" stroke="none" />
          <path d="M0-10 8 0 0 10" fill="none" />
        </g>
      ))}
      <g fill="none" opacity=".5">
        <circle cx="450" cy="112" r="5" />
        <circle cx="458" cy="87" r="3" />
        <circle cx="160" cy="200" r="4" />
      </g>
    </g>,
    <g key="turtle" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round">
      <path
        fill="var(--paper-2)"
        d="M-100 410Q140 275 340 338T720 320V600H-100Z"
      />
      <g transform="translate(305 278) rotate(-9)" fill="var(--mint)">
        <path d="M-35-12Q-70-42-76-20L-47 7M-22 14Q-46 50-10 30L10 13M27 13Q60 45 54 13L39-4M40-14Q90-40 80-10L48 9" />
        <ellipse rx="50" ry="30" />
        <path
          d="M-20-16 8-22 27-4 13 18-14 20-30 1ZM-20-16-30-23M27-4 49-4M13 18 20 27M-30 1-48 8"
          fill="none"
        />
        <circle cx="72" cy="-15" r="2" fill="var(--ink)" />
      </g>
      <path
        d="M-15 360Q-30 255 10 216Q28 247 7 286Q55 245 53 215Q90 262 33 309L35 360M570 365Q615 265 575 221Q550 266 582 290Q530 270 532 236Q505 280 555 324L550 365"
        fill="var(--mint)"
      />
    </g>,
  ];
  return (
    <div className="peep-aperture" data-peep-aperture>
      <svg
        viewBox="0 0 600 360"
        width="600"
        height="360"
        role="img"
        aria-label="A paper window into Ryugu-jo: a coral-roofed palace, kelp, fish and Urashima’s turtle."
        focusable="false"
      >
        <defs>
          <filter
            id="peep-ryugu-ink"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".045"
              numOctaves="2"
              seed="27"
              result="grain"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="grain"
              scale="1.1"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <rect width="600" height="360" fill="var(--paper)" />
        <g filter="url(#peep-ryugu-ink)">
          {layers.map((art, i) => {
            const p = projectLayer(NEUTRAL, DEPTHS[i]);
            return (
              <g
                key={DEPTHS[i]}
                data-peep-layer={DEPTHS[i]}
                transform={`matrix(${p.scale} 0 0 ${p.scale} ${p.x} ${p.y})`}
              >
                {art}
              </g>
            );
          })}
        </g>
      </svg>
      <span className="peep-label" aria-hidden="true">
        竜宮城 · Ryugu-jo
      </span>
    </div>
  );
}
