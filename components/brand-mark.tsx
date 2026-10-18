import Link from "next/link";
import { ViewTransition } from "react";
import { Doodle } from "@/components/doodles";

// morph: the one mark per screen that shares a view-transition name.
export function BrandMark({ morph = true }: { morph?: boolean }) {
  const mark = (
    <span className="inline-flex items-center gap-2 font-display text-[1.65rem] font-bold">
      <Doodle name="pearl" className="wiggle size-8 fill-pearl" />
      Otohime
    </span>
  );

  return (
    <Link href="/" className="inline-block text-ink">
      {morph ? (
        // share + default="none": morph between shells, no fade on every navigation
        <ViewTransition name="otohime-mark" share="auto" default="none">
          {mark}
        </ViewTransition>
      ) : (
        mark
      )}
    </Link>
  );
}
