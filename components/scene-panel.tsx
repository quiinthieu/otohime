import { useId } from "react";

export function ScenePanel() {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const bg = `scene-bg-${id}`;
  const shaft = `scene-shaft-${id}`;
  const pearl = `scene-pearl-${id}`;

  return (
    <div className="relative order-1 h-48 w-full shrink-0 self-stretch md:order-2 md:h-auto md:min-h-full md:w-[48%] md:p-3 md:pl-0">
      <div className="relative h-full min-h-48 overflow-hidden bg-[#1b5c6b] md:rounded-[1.25rem]">
        <svg
          viewBox="0 0 360 560"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Abstract tide palace and pearl"
        >
          <defs>
            <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#163a62" />
              <stop offset="55%" stopColor="#1f7a86" />
              <stop offset="100%" stopColor="#2aa3a8" />
            </linearGradient>
            <linearGradient id={shaft} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4e4c8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f4e4c8" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={pearl} cx="38%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f3eee6" />
              <stop offset="100%" stopColor="#d9cfc4" />
            </radialGradient>
          </defs>

          <rect width="360" height="560" fill={`url(#${bg})`} />

          <polygon points="210,0 262,0 168,560 96,560" fill={`url(#${shaft})`} />
          <polygon
            points="268,0 304,0 228,560 176,560"
            fill={`url(#${shaft})`}
            opacity="0.7"
          />

          <path
            d="M132 214 C168 186 192 186 228 214 L216 224 C192 202 168 202 144 224 Z"
            fill="#c5e64a"
          />
          <path
            d="M104 258 C158 218 202 218 256 258 L240 270 C202 238 158 238 120 270 Z"
            fill="#f0c8b0"
          />
          <path
            d="M72 308 C148 254 212 254 288 308 L268 322 C212 278 148 278 92 322 Z"
            fill="#f0c8b0"
          />

          <path
            d="M146 470 L146 348 Q146 308 180 308 Q214 308 214 348 L214 470 Z"
            fill="#1c2d6e"
          />

          <circle cx="272" cy="360" r="42" fill={`url(#${pearl})`} />
          <circle cx="258" cy="346" r="11" fill="#fff" opacity="0.5" />

          <path
            d="M0 430 C52 410 88 450 136 434 C184 418 220 450 268 434 C316 418 340 438 360 426 L360 560 L0 560 Z"
            fill="#f0c8b0"
          />
          <path
            d="M0 462 C56 442 96 482 148 464 C200 446 236 478 288 462 C328 450 344 466 360 458 L360 560 L0 560 Z"
            fill="#2aa3a8"
          />
          <path
            d="M0 498 C60 482 108 518 168 502 C228 486 268 518 324 502 C344 496 352 504 360 500 L360 560 L0 560 Z"
            fill="#1c2d6e"
          />
        </svg>
      </div>
    </div>
  );
}
