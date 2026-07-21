"use client";

import { supabase } from "./supabase";
import type { BacklogItem } from "./types";

/**
 * A user's own curated "top picks" shelf for one calendar month (see
 * supabase/migrations/0011_top_picks.sql). Private to the owner — this isn't
 * a friend-visible feature, just a homescreen highlight reel.
 */
export type TopPick = { id: string; position: number; item: BacklogItem };

/** The current month as "YYYY-MM", matching how picks are scoped in the DB. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export async function fetchTopPicks(
  userId: string,
  month: string,
): Promise<TopPick[]> {
  const { data } = await supabase
    .from("top_picks")
    .select("id,position,item:items(*)")
    .eq("user_id", userId)
    .eq("month", month)
    .order("position", { ascending: true });
  const rows = (data as unknown as { id: string; position: number; item: BacklogItem | null }[]) ?? [];
  return rows.filter((r): r is TopPick => r.item != null);
}

/** Replaces the whole shelf for this month with an ordered list of item ids (max 5). */
export async function saveTopPicks(
  userId: string,
  month: string,
  itemIds: string[],
): Promise<{ error: string | null }> {
  const { error: deleteError } = await supabase
    .from("top_picks")
    .delete()
    .eq("user_id", userId)
    .eq("month", month);
  if (deleteError) return { error: deleteError.message };

  const trimmed = itemIds.slice(0, 5);
  if (!trimmed.length) return { error: null };

  const rows = trimmed.map((item_id, i) => ({
    user_id: userId,
    month,
    item_id,
    position: i + 1,
  }));
  const { error } = await supabase.from("top_picks").insert(rows);
  return { error: error?.message ?? null };
}
