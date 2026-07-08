"use client";

import { supabase } from "./supabase";
import type { BacklogItem, MediaType, Profile } from "./types";

/**
 * Friend-system data layer. All reads/writes go through Supabase and are
 * gated by row-level security (see supabase/migrations/0002_friends.sql):
 * profiles are readable by any signed-in user; a user's items are readable
 * by accepted friends unless marked private.
 */

/** An items row including its owner id (the domain BacklogItem omits it). */
export type ItemRow = BacklogItem & { user_id: string };

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
  responded_at: string | null;
};

export type Connection = {
  friendshipId: string;
  profile: Profile;
  since: string;
};

export type Connections = {
  friends: Connection[];
  incoming: Connection[];
  outgoing: Connection[];
};

export type RelationStatus =
  | "self"
  | "none"
  | "friends"
  | "incoming"
  | "outgoing";

/* ---------- profiles ---------- */

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .in("id", unique);
  return (data as Profile[]) ?? [];
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export async function createProfile(
  userId: string,
  username: string,
  displayName: string,
): Promise<{ error: string | null; profile?: Profile }> {
  const uname = normalizeUsername(username);
  if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
    return {
      error: "Handles are 3–20 characters: lowercase letters, numbers or underscores.",
    };
  }
  const dn = displayName.trim() || uname;
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: userId, username: uname, display_name: dn })
    .select("id,username,display_name")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That handle's taken — try another." };
    return { error: error.message };
  }
  return { error: null, profile: data as Profile };
}

export async function searchProfiles(
  query: string,
  myId: string,
): Promise<Profile[]> {
  const term = normalizeUsername(query);
  if (term.length < 2) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .ilike("username", `${term}%`)
    .neq("id", myId)
    .limit(10);
  return (data as Profile[]) ?? [];
}

/* ---------- friendships ---------- */

/** Every friendship row touching me, split by kind with the other person's profile. */
export async function fetchConnections(myId: string): Promise<Connections> {
  const { data: rows } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
  const list = (rows as Friendship[]) ?? [];

  const otherIds = list.map((r) =>
    r.requester_id === myId ? r.addressee_id : r.requester_id,
  );
  const profileMap = new Map(
    (await fetchProfilesByIds(otherIds)).map((p) => [p.id, p]),
  );

  const out: Connections = { friends: [], incoming: [], outgoing: [] };
  for (const r of list) {
    const otherId = r.requester_id === myId ? r.addressee_id : r.requester_id;
    const profile = profileMap.get(otherId);
    if (!profile) continue;
    const conn: Connection = {
      friendshipId: r.id,
      profile,
      since: r.responded_at ?? r.created_at,
    };
    if (r.status === "accepted") out.friends.push(conn);
    else if (r.addressee_id === myId) out.incoming.push(conn);
    else out.outgoing.push(conn);
  }
  return out;
}

async function existingFriendship(
  myId: string,
  otherId: string,
): Promise<Friendship | null> {
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`,
    )
    .maybeSingle();
  return (data as Friendship) ?? null;
}

export async function sendFriendRequest(
  myId: string,
  addresseeId: string,
): Promise<{ error: string | null; accepted?: boolean }> {
  const existing = await existingFriendship(myId, addresseeId);
  if (existing) {
    if (existing.status === "accepted") return { error: "You're already friends." };
    if (existing.requester_id === myId) return { error: "Request already sent." };
    // They already requested me — accept instead of creating a duplicate.
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", existing.id);
    return error ? { error: error.message } : { error: null, accepted: true };
  }
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: myId, addressee_id: addresseeId });
  return error ? { error: error.message } : { error: null };
}

export async function acceptRequest(friendshipId: string): Promise<string | null> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  return error?.message ?? null;
}

/** Used to decline an incoming request, cancel an outgoing one, or unfriend. */
export async function removeFriendship(
  friendshipId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);
  return error?.message ?? null;
}

/* ---------- a friend's library ---------- */

export type FriendView = {
  profile: Profile;
  relation: RelationStatus;
  friendshipId: string | null;
};

export async function fetchFriendByUsername(
  username: string,
  myId: string,
): Promise<FriendView | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .eq("username", normalizeUsername(username))
    .maybeSingle();
  if (!profile) return null;

  if (profile.id === myId) {
    return { profile: profile as Profile, relation: "self", friendshipId: null };
  }

  const fr = await existingFriendship(myId, profile.id);
  let relation: RelationStatus = "none";
  if (fr) {
    if (fr.status === "accepted") relation = "friends";
    else relation = fr.addressee_id === myId ? "incoming" : "outgoing";
  }
  return {
    profile: profile as Profile,
    relation,
    friendshipId: fr?.id ?? null,
  };
}

/** A friend's items (RLS returns only their non-private rows). */
export async function fetchUserItems(userId: string): Promise<BacklogItem[]> {
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as BacklogItem[]) ?? [];
}

export type FriendStat = {
  total: number;
  completed: number;
  avgRating: number | null;
};

/** Per-friend headline numbers for the friends list. */
export async function fetchFriendStats(
  friends: Connection[],
): Promise<Map<string, FriendStat>> {
  const stats = new Map<string, FriendStat>();
  if (!friends.length) return stats;
  const ids = friends.map((f) => f.profile.id);
  const { data } = await supabase
    .from("items")
    .select("user_id,status,rating")
    .in("user_id", ids);
  const rows =
    (data as { user_id: string; status: string; rating: number | null }[]) ?? [];

  const acc = new Map<string, { total: number; completed: number; ratings: number[] }>();
  ids.forEach((id) => acc.set(id, { total: 0, completed: 0, ratings: [] }));
  for (const r of rows) {
    const a = acc.get(r.user_id);
    if (!a) continue;
    a.total++;
    if (r.status === "completed") a.completed++;
    if (r.rating != null) a.ratings.push(r.rating);
  }
  for (const [id, a] of acc) {
    stats.set(id, {
      total: a.total,
      completed: a.completed,
      avgRating: a.ratings.length
        ? a.ratings.reduce((x, y) => x + y, 0) / a.ratings.length
        : null,
    });
  }
  return stats;
}

/* ---------- "friends also have" ---------- */

export type AlsoHave = { profile: Profile; item: BacklogItem };

export async function fetchAlsoHave(
  mediaType: MediaType,
  externalId: string,
  myId: string,
): Promise<AlsoHave[]> {
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("media_type", mediaType)
    .eq("external_id", externalId)
    .neq("user_id", myId);
  const rows = (data as ItemRow[]) ?? [];
  if (!rows.length) return [];
  const profileMap = new Map(
    (await fetchProfilesByIds(rows.map((r) => r.user_id))).map((p) => [p.id, p]),
  );
  return rows
    .filter((r) => profileMap.has(r.user_id))
    .map((r) => ({ profile: profileMap.get(r.user_id)!, item: r }));
}

/* ---------- activity feed ---------- */

export type ActivityEntry = { item: ItemRow; profile: Profile };

/** Turns an item's current state into a feed verb, e.g. "rated", "completed". */
export function activityVerb(item: BacklogItem): {
  verb: string;
  showStars: boolean;
} {
  if (item.status === "completed") {
    return item.rating != null
      ? { verb: "rated", showStars: true }
      : { verb: "completed", showStars: false };
  }
  if (item.status === "in_progress") return { verb: "started", showStars: false };
  if (item.status === "dropped") return { verb: "dropped", showStars: false };
  return { verb: "added", showStars: false };
}

export async function fetchActivity(
  friends: Connection[],
): Promise<ActivityEntry[]> {
  if (!friends.length) return [];
  const ids = friends.map((f) => f.profile.id);
  const { data } = await supabase
    .from("items")
    .select("*")
    .in("user_id", ids)
    .order("updated_at", { ascending: false })
    .limit(40);
  const rows = (data as ItemRow[]) ?? [];
  const profileMap = new Map(friends.map((f) => [f.profile.id, f.profile]));
  return rows
    .filter((r) => profileMap.has(r.user_id))
    .map((r) => ({ item: r, profile: profileMap.get(r.user_id)! }));
}

/* ---------- recommendations ---------- */

export type Recommendation = {
  item: BacklogItem;
  raters: { profile: Profile; rating: number | null }[];
  avg: number;
};

export async function fetchRecommendations(
  myId: string,
  friends: Connection[],
): Promise<Recommendation[]> {
  if (!friends.length) return [];
  const ids = friends.map((f) => f.profile.id);

  const [{ data: friendRows }, { data: mineRows }] = await Promise.all([
    supabase.from("items").select("*").in("user_id", ids).gte("rating", 4),
    supabase.from("items").select("media_type,external_id").eq("user_id", myId),
  ]);

  const have = new Set(
    ((mineRows as { media_type: string; external_id: string }[]) ?? []).map(
      (m) => `${m.media_type}:${m.external_id}`,
    ),
  );
  const profileMap = new Map(friends.map((f) => [f.profile.id, f.profile]));

  const groups = new Map<
    string,
    { item: ItemRow; raters: { profile: Profile; rating: number | null }[] }
  >();
  for (const r of (friendRows as ItemRow[]) ?? []) {
    const key = `${r.media_type}:${r.external_id}`;
    if (have.has(key)) continue;
    const profile = profileMap.get(r.user_id);
    if (!profile) continue;
    if (!groups.has(key)) groups.set(key, { item: r, raters: [] });
    groups.get(key)!.raters.push({ profile, rating: r.rating });
  }

  const recs = [...groups.values()].map((g) => {
    const scores = g.raters
      .map((x) => x.rating)
      .filter((n): n is number => n != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { item: g.item, raters: g.raters, avg };
  });
  recs.sort((a, b) => b.raters.length - a.raters.length || b.avg - a.avg);
  return recs.slice(0, 24);
}

/* ---------- taste match ---------- */

export type TasteMatch = {
  sharedCount: number;
  coRated: number;
  score: number | null; // 0–100 agreement, null when nothing co-rated
  agreements: { title: string; mine: number; theirs: number }[];
  clashes: { title: string; mine: number; theirs: number }[];
};

export function computeTasteMatch(
  mine: BacklogItem[],
  theirs: BacklogItem[],
): TasteMatch {
  const keyOf = (i: BacklogItem) => `${i.media_type}:${i.external_id}`;
  const theirMap = new Map(theirs.map((i) => [keyOf(i), i]));

  let sharedCount = 0;
  const coRated: { title: string; mine: number; theirs: number; diff: number }[] = [];

  for (const m of mine) {
    const t = theirMap.get(keyOf(m));
    if (!t) continue;
    sharedCount++;
    if (m.rating != null && t.rating != null) {
      coRated.push({
        title: m.title,
        mine: m.rating,
        theirs: t.rating,
        diff: Math.abs(m.rating - t.rating),
      });
    }
  }

  let score: number | null = null;
  if (coRated.length) {
    const avgDiff =
      coRated.reduce((a, b) => a + b.diff, 0) / coRated.length;
    // Max possible difference on a 0.5–5 scale is 4.5.
    score = Math.round((1 - avgDiff / 4.5) * 100);
  }

  const agreements = coRated
    .filter((c) => c.diff <= 0.5)
    .sort((a, b) => b.mine + b.theirs - (a.mine + a.theirs))
    .map(({ title, mine: m, theirs: t }) => ({ title, mine: m, theirs: t }));
  const clashes = coRated
    .filter((c) => c.diff >= 1.5)
    .sort((a, b) => b.diff - a.diff)
    .map(({ title, mine: m, theirs: t }) => ({ title, mine: m, theirs: t }));

  return { sharedCount, coRated: coRated.length, score, agreements, clashes };
}
