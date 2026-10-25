import { AddChannelForm } from "@/components/add-channel-form";
import { NowPlayingShelf } from "@/components/cassette";
import { FigTitle, swatches } from "@/components/figures";
import { InkRadioLoader } from "@/components/ink-radio-loader";
import { RemoveChannelButton } from "@/components/remove-channel-button";
import { Television } from "@/components/television";
import { site, type Song } from "@/content/site";
import { getSession } from "@/lib/dal";
import { readNowPlaying } from "@/lib/now-playing";
import { sanitize } from "@/lib/now-playing-data";
import { peekMark } from "@/lib/peek-marks";
import { peekSlug } from "@/lib/peeks";
import { can } from "@/lib/permissions";
import { listSongs } from "@/lib/songs-store";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, ViewTransition } from "react";
import stations from "./_lib/stations.json";
import "./ink-radio.css";

export const metadata: Metadata = { title: "Music" };

// The cassette prints a live reading, and must with JavaScript off: inside a streamed boundary it would arrive in a
// hidden <div> only a script swaps in. So the page waits for the request and the cached reading (lib/now-playing.ts,
// at most 4 s on a miss) before it renders, outside any <Suspense>. The channels and owner tools keep theirs.
export const instant = false;

const ch = (i: number) => `CH ${String(i + 1).padStart(2, "0")}`;

export default async function MusicPage() {
  await connection();
  const nowPlaying = sanitize(await readNowPlaying());
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="05" morph="/music" hint="one song per channel">
          Music
        </FigTitle>
        <p className="mt-2 text-muted">{site.music}</p>
        <Suspense fallback={<Channels songs={site.songs} />}>
          <LiveChannels />
        </Suspense>
        <NowPlayingShelf reading={nowPlaying} />
        <InkRadio />
        <Suspense fallback={null}>
          <OwnerTools />
        </Suspense>
      </div>
    </ViewTransition>
  );
}

async function LiveChannels() {
  return <Channels songs={[...site.songs, ...(await listSongs())]} />;
}

function Channels({ songs }: { songs: Song[] }) {
  return (
    <>
      <div className="mt-8">
        <Television songs={songs} playlist={site.playlist} />
      </div>
      <h2 className="caption mt-12">Listings</h2>
      <ol className="mt-3 grid gap-x-10 sm:grid-cols-2">
        {songs.map((song, i) => (
          <li key={`${i}-${song.video}`} className="flex items-start gap-3 border-t border-line py-3">
            <span
              aria-hidden="true"
              className="mt-1 size-3 flex-none rounded-full border border-on-swatch"
              style={{ background: swatches[song.colour] }}
            />
            <span>
              <span className="caption block">{ch(i)}</span>
              <span className="block">
                <span className="font-semibold">{song.title}</span>{" "}
                <span className="text-muted">
                  · <Credit artist={song.artist} />
                </span>
              </span>
              <span className="text-muted">{song.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

// Outside the channels' Suspense boundary, so a stream started early is not remounted when the songs arrive.
function InkRadio() {
  return (
    <section aria-labelledby="ink-radio" className="mt-12">
      <h2 id="ink-radio" className="caption">
        Ink Radio <span className="text-muted">· experimental</span>
      </h2>
      <p className="mt-2 text-muted">
        Spin the globe or turn the dial to tune in to live stations around the world. Nothing plays until you press
        play.
      </p>
      <div className="mt-6">
        <InkRadioLoader />
      </div>
      <p className="mt-4 text-[12px] text-muted" data-radio="credit">
        {stations.stations.length} stations from{" "}
        <a href="https://www.radio-browser.info" className="underline" target="_blank" rel="noreferrer">
          Radio Browser
        </a>{" "}
        (public domain), checked <time dateTime={stations.retrieved}>{stations.retrieved.slice(0, 10)}</time>. The
        streams belong to their stations and may be off air.
      </p>
    </section>
  );
}

async function OwnerTools() {
  const session = await getSession();
  if (!session || !can(session.user.role, { song: ["create"] })) return null;
  const added = await listSongs();
  return (
    <section className="mt-12">
      <h2 className="caption">Add a channel</h2>
      <AddChannelForm />
      {added.length > 0 ? (
        <>
          <h2 className="caption mt-10">Added channels</h2>
          <ul className="mt-3">
            {added.map((song, i) => (
              <li
                key={song.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3"
              >
                <span>
                  <span className="caption mr-3">{ch(site.songs.length + i)}</span>
                  <span className="font-semibold">{song.title}</span>{" "}
                  <span className="text-muted">· {song.artist}</span>
                </span>
                <RemoveChannelButton id={song.id} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

// A credit the peek index knows is a button that fans out three related items; any other stays text.
function Credit({ artist }: { artist: string }) {
  const mark = peekMark(`credit:${peekSlug(artist)}`);
  if (!mark) return artist;
  return (
    <button type="button" className="peek-credit" {...mark}>
      {artist}
    </button>
  );
}
