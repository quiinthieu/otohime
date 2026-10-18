import Link from "next/link";
import { ViewTransition } from "react";

export function BrandMark() {
  return (
    <Link href="/" className="inline-block">
      <ViewTransition name="otohime-mark">
        <span className="text-[1.65rem] font-display font-bold text-sea">
          Otohime
        </span>
      </ViewTransition>
    </Link>
  );
}
