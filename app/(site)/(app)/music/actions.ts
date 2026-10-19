"use server";

import { getSession } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { parseSong, type SongField } from "@/lib/songs";
import { deleteSong, insertSong } from "@/lib/songs-store";
import { refresh } from "next/cache";

export type SongFormState = {
  ok?: boolean;
  error?: string;
  errors?: Partial<Record<SongField, string>>;
};

const DENIED: SongFormState = { error: "Only owners can change channels." };

export async function addSong(_prev: SongFormState, form: FormData): Promise<SongFormState> {
  const session = await getSession();
  if (!session || !can(session.user.role, { song: ["create"] })) return DENIED;

  const parsed = parseSong(Object.fromEntries(form));
  if (!parsed.ok) return { errors: parsed.errors };

  const result = await insertSong(parsed.song, session.user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true };
}

export async function removeSong(_prev: SongFormState, form: FormData): Promise<SongFormState> {
  const session = await getSession();
  if (!session || !can(session.user.role, { song: ["delete"] })) return DENIED;

  const id = form.get("id");
  if (typeof id !== "string" || !id) return { error: "Pick a channel to remove." };
  if (!(await deleteSong(id))) return { error: "That channel is already gone." };
  refresh();
  return { ok: true };
}
