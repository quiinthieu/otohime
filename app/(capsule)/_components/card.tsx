"use client";

import { useId } from "react";
import type { Card as CardData } from "../_lib/cards.ts";
import { cardFaceSvg } from "../_lib/art/svg.ts";

// One card face: paper, tier band, the drawing from ART under a wobble filter,
// and the name. The markup comes from the same cardFaceSvg the art sheet uses,
// from our own data only. ghost is an unowned album slot: a grey silhouette.
export function Card({ card, ghost = false, className }: { card: CardData; ghost?: boolean; className?: string }) {
  // useId may contain characters a url(#...) reference does not like.
  const filterId = `wobble${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <svg
      className={className ? `card ${className}` : "card"}
      viewBox="0 0 120 160"
      role="img"
      aria-label={ghost ? `Not found yet: a ${card.tier} card` : `${card.name}, ${card.film} (${card.year})`}
      dangerouslySetInnerHTML={{ __html: cardFaceSvg(card, filterId, ghost) }}
    />
  );
}
