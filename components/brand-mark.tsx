import Link from "next/link";

export function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <svg
        viewBox="0 0 32 32"
        className="size-9"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 6.5 26.2 5.6 26.8 26.6 5.6 27.2Z" />
        <path d="M16 10.4c3.2-.2 5.6 2.4 5.5 5.6-.1 3.1-2.6 5.5-5.7 5.4-3-.1-5.3-2.7-5.2-5.7.1-3 2.5-5.2 5.4-5.3" />
      </svg>
      <span className="font-bold tracking-[0.02em]">otohime</span>
    </Link>
  );
}
