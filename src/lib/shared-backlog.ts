"use client";

import { supabase } from "./supabase";
import { fetchProfilesByIds } from "./social";
import type { AddInput } from "./backlog-store";
import type { ItemMeta, MediaType, Profile } from "./types";

/**
 * Shared backlog: titles two friends plan to play/watch together. Each row
 * pairs one title with exactly one friend (see supabase/migrations/0012_shared_backlog.sql);
 * sharing with several friends just adds several rows. RLS lets either
 * participant read, update (status) or delete the row.
 */

export type SharedStatus = "planned" | "completed";

export type SharedItem = {
  id: string;
  media_type: MediaType;
  external_id: string;
  title: string;
  cover_url: string | null;
  release_year: number | null;
  genres: string[];
  meta: ItemMeta;
  status: SharedStatus;
  added_by: string;
  friend_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/** A shared row plus whichever profile isn't me. */
export type SharedEntry = { item: SharedItem; friend: Profile; addedByMe: boolean };

export async function fetchSharedBacklog(myId: string): Promise<SharedEntry[]> {
  const { data } = await supabase
    .from("shared_items")
    .select("*")
    .or(`added_by.eq.${myId},friend_id.eq.${myId}`)
    .order("created_at", { ascending: false });
  const rows = (data as SharedItem[]) ?? [];
  if (!rows.length) return [];

  const otherIds = rows.map((r) => (r.added_by === myId ? r.friend_id : r.added_by));
  const profiles = new Map((await fetchProfilesByIds(otherIds)).map((p) => [p.id, p]));

  return rows
    .filter((r) => profiles.has(r.added_by === myId ? r.friend_id : r.added_by))
    .map((r) => ({
      item: r,
      friend: profiles.get(r.added_by === myId ? r.friend_id : r.added_by)!,
      addedByMe: r.added_by === myId,
    }));
}

/** Adds a title to the shared backlog with one friend. Fails quietly (as "duplicate") if it's already there, in either direction. */
export async function addToSharedBacklog(
  myId: string,
  friendId: string,
  input: AddInput,
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from("shared_items")
    .select("id")
    .eq("media_type", input.mediaType)
    .eq("external_id", input.externalId)
    .or(
      `and(added_by.eq.${myId},friend_id.eq.${friendId}),and(added_by.eq.${friendId},friend_id.eq.${myId})`,
    )
    .maybeSingle();
  if (existing) return { error: "duplicate" };

  const { error } = await supabase.from("shared_items").insert({
    media_type: input.mediaType,
    external_id: input.externalId,
    title: input.title,
    cover_url: input.coverUrl,
    release_year: input.releaseYear,
    genres: input.genres,
    meta: input.meta,
    added_by: myId,
    friend_id: friendId,
  });
  if (error) {
    if (error.code === "23505") return { error: "duplicate" };
    return { error: error.message };
  }
  return { error: null };
}

export async function updateSharedStatus(
  id: string,
  status: SharedStatus,
): Promise<string | null> {
  const { error } = await supabase
    .from("shared_items")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return error?.message ?? null;
}

export async function removeSharedItem(id: string): Promise<string | null> {
  const { error } = await supabase.from("shared_items").delete().eq("id", id);
  return error?.message ?? null;
}
