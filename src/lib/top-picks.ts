"use client";

import { supabase } from "./supabase";
import type { BacklogItem } from "./types";

/**
 * A user's curated "top picks" shelf for one calendar month (see
 * supabase/migrations/0011_top_picks.sql and 0013_top_picks_friends_visible.sql).
 * Editable by the owner only, but readable by accepted friends too.
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

/** Adds (or subtracts) whole months from a "YYYY-MM" string. */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function fetchTopPicks(
  userId: string,
  month: string,
): Promise<TopPick[]> {
  const { data, error } = await supabase
    .from("top_picks")
    .select("id,position,item:items(*)")
    .eq("user_id", userId)
    .eq("month", month)
    .order("position", { ascending: true });
  if (error) throw error;
  const rows = (data as unknown as { id: string; position: number; item: BacklogItem | null }[]) ?? [];
  return rows.filter((r): r is TopPick => r.item != null);
}

/** Batched version of fetchTopPicks for a group of friends at once (e.g. the homescreen). */
export async function fetchTopPicksForUsers(
  userIds: string[],
  month: string,
): Promise<Map<string, TopPick[]>> {
  const map = new Map<string, TopPick[]>();
  if (!userIds.length) return map;
  const { data } = await supabase
    .from("top_picks")
    .select("id,position,user_id,item:items(*)")
    .in("user_id", userIds)
    .eq("month", month)
    .order("position", { ascending: true });
  const rows =
    (data as unknown as {
      id: string;
      position: number;
      user_id: string;
      item: BacklogItem | null;
    }[]) ?? [];
  for (const r of rows) {
    if (!r.item) continue;
    const list = map.get(r.user_id) ?? [];
    list.push({ id: r.id, position: r.position, item: r.item });
    map.set(r.user_id, list);
  }
  return map;
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
