import Link from "next/link";

export function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 text-ink hover:opacity-80">
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0"
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
