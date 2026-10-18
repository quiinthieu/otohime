import { FigTitle, swatches } from "@/components/figures";
import { YouTubePlayer } from "@/components/youtube-player";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Music" };

export default function MusicPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="05" hint="side a, side b">
          Music
        </FigTitle>
        <p className="mt-2 text-muted">{site.music}</p>
        <div className="mt-8">
          <YouTubePlayer songs={site.songs} playlist={site.playlist} />
        </div>
        <h2 className="caption mt-12">On the tape</h2>
        <ul className="mt-3 grid gap-x-10 sm:grid-cols-2">
          {site.songs.map((song) => (
            <li key={song.title} className="flex items-start gap-3 border-t border-line py-3">
              <span
                aria-hidden="true"
                className="mt-1 size-3 flex-none rounded-full border border-on-swatch"
                style={{ background: swatches[song.colour] }}
              />
              <span>
                <span className="block">
                  <span className="font-semibold">{song.title}</span>{" "}
                  <span className="text-muted">· {song.artist}</span>
                </span>
                <span className="text-muted">{song.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ViewTransition>
  );
}
