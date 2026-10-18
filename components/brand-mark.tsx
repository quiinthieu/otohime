import Link from "next/link";
import { ViewTransition } from "react";
import { Doodle } from "@/components/doodles";

export function BrandMark() {
  return (
    <Link href="/" className="inline-block text-ink">
      {/* share + default="none": morph between shells, no fade on every navigation */}
      <ViewTransition name="otohime-mark" share="auto" default="none">
        <span className="inline-flex items-center gap-2 font-display text-[1.65rem] font-bold">
          <Doodle name="pearl" className="wiggle size-8 fill-pearl" />
          Otohime
        </span>
      </ViewTransition>
    </Link>
  );
}
