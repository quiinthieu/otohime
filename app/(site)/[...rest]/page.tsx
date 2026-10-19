import { notFound } from "next/navigation";

// With no top-level layout, an unmatched URL would get Next's bare default 404.
// Calling notFound() here renders app/(site)/not-found.tsx inside the site layout.
//
// With cacheComponents, an unknown path would otherwise get the prerendered fallback
// shell, which for notFound() is an empty error page. ensureStatic = "navigation"
// makes Next render each unknown path in full, with its 404 status, before serving it.
// That mode needs at least one prerendered path; /not-found is that one.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return [{ rest: ["not-found"] }];
}

export default function CatchAll() {
  notFound();
}
