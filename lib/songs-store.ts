import "server-only";
import { asc, eq, max } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { site } from "../content/site";
import { db } from "../db/client";
import { song } from "../db/schema";
import { MAX_ADDED_SONGS, SWATCH_KEYS, type SongInput } from "./songs";

export type StoredSong = SongInput & { id: string };

// Read per request, never at build: CI and production build before they migrate.
export const listSongs = cache(async (): Promise<StoredSong[]> => {
  await connection();
  try {
    const rows = await db.select().from(song).orderBy(asc(song.position), asc(song.createdAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      note: r.note,
      colour: (SWATCH_KEYS as readonly string[]).includes(r.colour)
        ? (r.colour as SongInput["colour"])
        : SWATCH_KEYS[0],
      video: r.video,
    }));
  } catch (error) {
    console.error("listSongs failed", error);
    return [];
  }
});

export async function insertSong(
  input: SongInput,
  createdBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await db.select({ video: song.video }).from(song).orderBy(asc(song.position), asc(song.createdAt));
  if (rows.length >= MAX_ADDED_SONGS) {
    return { ok: false, error: `${MAX_ADDED_SONGS} channels added. Remove one to add another.` };
  }
  const taken = [...site.songs.map((s) => s.video), ...rows.map((r) => r.video)].indexOf(input.video);
  if (taken >= 0) return { ok: false, error: `That video is already channel ${taken + 1}.` };

  const [top] = await db.select({ position: max(song.position) }).from(song);
  await db.insert(song).values({
    ...input,
    id: crypto.randomUUID(),
    position: top?.position == null ? 0 : top.position + 1,
    createdBy,
  });
  return { ok: true };
}

export async function deleteSong(id: string): Promise<boolean> {
  const gone = await db.delete(song).where(eq(song.id, id)).returning({ id: song.id });
  return gone.length > 0;
}
