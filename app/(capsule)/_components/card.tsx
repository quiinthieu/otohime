"use client";

import { useId } from "react";
import type { Card as CardData, Tier } from "../_lib/cards.ts";
import { cardBackSvg, cardFaceSvg } from "../_lib/art/svg.ts";

type Look = { grain?: boolean; className?: string };
type Props =
  | ({ card: CardData; back?: undefined; label?: undefined } & Look)
  // a back names no card: its label is passed in
  | ({ card?: undefined; back: { number?: number; edge?: Tier }; label: string } & Look);

// One printed card, face or back. The markup comes from the same cardFaceSvg
// and cardBackSvg the art sheet uses, from our own data only. grain lays the
// paper grain over it (for one large card, never the album thumbnails).
export function Card({ card, back, label, grain = false, className }: Props) {
  // useId may contain characters a url(#...) reference does not like.
  const id = `grain${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const o = grain ? { grain: id } : {};
  const html = card ? cardFaceSvg(card, o) : cardBackSvg({ ...back, ...o });
  return (
    <svg
      className={className ? `card ${className}` : "card"}
      viewBox="0 0 120 160"
      role="img"
      aria-label={card ? `${card.name}, ${card.film} (${card.year})` : label}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
