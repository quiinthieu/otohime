import Link from "next/link";

export function BrandMark() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 text-ink transition-opacity hover:opacity-80 focus-visible:rounded-sm"
      aria-label="Otohime home"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0 transition-transform duration-200 group-hover:scale-105"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
      <span className="font-semibold tracking-[0.02em]">otohime</span>
    </Link>
  );
}
