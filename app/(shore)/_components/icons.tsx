// Stroke paths for the icons Shore uses. sun, moon, reset and check are copied
// from the sea-glass playground's app.mjs; play and pause are drawn to match.
const paths = {
  play: <path d="M7 4.5v15l12-7.5-12-7.5Z" />,
  pause: <path d="M8 4.5v15m8-15v15" />,
  reset: <path d="M3 4v6h6M3.5 9A8 8 0 1 1 4 17" />,
  check: <path d="m5 12 4 4L19 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  moon: <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
