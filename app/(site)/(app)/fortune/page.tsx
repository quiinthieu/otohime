import type { Metadata } from "next";
import { connection } from "next/server";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { site } from "@/content/site";
import { buildFortuneTargets } from "@/lib/fortune-targets";
import { listSongs } from "@/lib/songs-store";
import { FortuneTeller } from "./fortune-teller";
import "./fortune.css";

export const metadata: Metadata = { title: "Origami Fortune Teller", description: "Fold a paper fortune and find a corner of Otohime's site." };
export const instant = false;

export default async function FortunePage() {
  await connection();
  const ownerSongs = await listSongs().catch(() => []);
  const targets = buildFortuneTargets({
    projects: site.projectList, notes: site.notes, sketches: site.sketches,
    songs: site.songs, ownerSongs,
  });
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <FigTitle n="10" hint="one fold, one place to go">Origami Fortune Teller</FigTitle>
    <p className="mt-2 max-w-prose text-muted">Choose a colour, count the folds, and lift a flap. The paper points to a real piece of this site.</p>
    <FortuneTeller targets={targets} />
  </div></ViewTransition>;
}
