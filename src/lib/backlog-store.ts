"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { toast } from "./toast-bus";
import type {
  BacklogItem,
  ItemMeta,
  ItemStatus,
  MediaType,
  Profile,
} from "./types";

/**
 * Cloud persistence: the library lives in the `items` table in Supabase,
 * scoped per user by RLS. Reads happen on mount; writes are optimistic.
 * On first sign-in, anything left over from the old localStorage era is
 * uploaded once, then kept locally under a `:migrated` key as a backup.
 */

const LEGACY_KEY = "backlog:v1";

/* ---------- session ---------- */

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, ready };
}

export const AuthContext = createContext<{
  session: Session | null;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
}>({
  session: null,
  profile: null,
  setProfile: () => {},
});
export const useAuth = () => useContext(AuthContext);

/* ---------- items ---------- */

export type AddInput = {
  mediaType: MediaType;
  externalId: string;
  title: string;
  coverUrl: string | null;
  releaseYear: number | null;
  genres: string[];
  meta: ItemMeta;
};

/** An item pulled from an external library (Steam/MAL/Letterboxd), ready for bulkAdd. */
export type ImportInput = AddInput & {
  status?: ItemStatus;
  rating?: number | null;
  review?: string | null;
  progress?: number | null;
  hoursPlayed?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type UpdatePatch = {
  status?: ItemStatus;
  rating?: number | null;
  review?: string | null;
  is_private?: boolean;
  is_favorite?: boolean;
  started_at?: string | null;
  progress?: number | null;
  hours_played?: number | null;
  notes?: string | null;
  pinned_at?: string | null;
};

function looksLikeItem(i: unknown): i is BacklogItem {
  const x = i as BacklogItem;
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.media_type === "string" &&
    typeof x.status === "string"
  );
}

/** One-time upload of items from the app's localStorage era. */
async function importLegacyLocalItems(userId: string) {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;

  let local: unknown;
  try {
    local = JSON.parse(raw);
  } catch {
    localStorage.removeItem(LEGACY_KEY);
    return;
  }
  const valid = Array.isArray(local) ? local.filter(looksLikeItem) : [];

  if (valid.length) {
    // Only seed an empty account — never clobber existing cloud data.
    // Scope to the owner: friends' items are now readable too, via RLS.
    const { count, error } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    if ((count ?? 0) === 0) {
      const { error: insertError } = await supabase
        .from("items")
        .insert(valid.map((i) => ({ ...i, user_id: userId })));
      if (insertError) throw insertError;
    }
  }

  // Keep a local copy as a safety net, but stop re-importing.
  localStorage.setItem(`${LEGACY_KEY}:migrated`, raw);
  localStorage.removeItem(LEGACY_KEY);
}

/**
 * Session-scoped in-memory cache so switching between section tabs shows the
 * last-known items instantly while a background refetch revalidates.
 */
const itemsCache = {
  userId: null as string | null,
  map: new Map<MediaType, BacklogItem[]>(),
};

function cacheGet(userId: string, mediaType: MediaType): BacklogItem[] | null {
  return itemsCache.userId === userId
    ? (itemsCache.map.get(mediaType) ?? null)
    : null;
}

function cacheSet(userId: string, mediaType: MediaType, items: BacklogItem[]) {
  if (itemsCache.userId !== userId) {
    itemsCache.userId = userId;
    itemsCache.map.clear();
  }
  itemsCache.map.set(mediaType, items);
}

export function useBacklog(mediaType: MediaType) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const cached = userId ? cacheGet(userId, mediaType) : null;
  const [items, setItems] = useState<BacklogItem[]>(cached ?? []);
  const [ready, setReady] = useState(cached !== null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Update state and keep the tab-switch cache in step. */
  const commit = useCallback(
    (next: BacklogItem[]) => {
      if (userId) cacheSet(userId, mediaType, next);
      setItems(next);
    },
    [userId, mediaType],
  );

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    (async () => {
      try {
        await importLegacyLocalItems(userId);
        const { data, error } = await supabase
          .from("items")
          .select("*")
          .eq("user_id", userId)
          .eq("media_type", mediaType)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (alive) {
          cacheSet(userId, mediaType, data as BacklogItem[]);
          setItems(data as BacklogItem[]);
          setLoadError(null);
          setReady(true);
        }
      } catch (err) {
        console.warn("Could not load items from Supabase", err);
        if (alive) {
          setLoadError(
            "Couldn't load your library. If this is a fresh Supabase project, run supabase/migrations/0001_items.sql in the SQL Editor first.",
          );
          setReady(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, mediaType]);

  const add = useCallback(
    async (input: AddInput): Promise<{ error: string | null }> => {
      if (!userId) return { error: "Not signed in." };
      if (
        items.some(
          (i) =>
            i.media_type === input.mediaType &&
            i.external_id === input.externalId,
        )
      ) {
        return { error: "duplicate" };
      }
      const now = new Date().toISOString();
      const item: BacklogItem = {
        id: crypto.randomUUID(),
        media_type: input.mediaType,
        external_id: input.externalId,
        title: input.title,
        cover_url: input.coverUrl,
        release_year: input.releaseYear,
        genres: input.genres,
        meta: input.meta,
        status: "backlog",
        rating: null,
        review: null,
        is_private: false,
        is_favorite: false,
        started_at: null,
        progress: null,
        hours_played: null,
        notes: null,
        pinned_at: null,
        created_at: now,
        updated_at: now,
        completed_at: null,
      };
      const { error } = await supabase
        .from("items")
        .insert({ ...item, user_id: userId });
      if (error) {
        if (error.code === "23505") return { error: "duplicate" };
        return { error: error.message };
      }
      commit([item, ...items]);
      return { error: null };
    },
    [items, userId, commit],
  );

  /**
   * Bulk-insert items pulled from an external library import. Dedupes against
   * what's already in the library (and within the batch itself) by external
   * id, then writes in a few chunked inserts rather than one round trip per
   * title — an import can easily carry hundreds of rows.
   */
  const bulkAdd = useCallback(
    async (
      inputs: ImportInput[],
    ): Promise<{ added: number; skipped: number; error: string | null }> => {
      if (!userId) return { added: 0, skipped: inputs.length, error: "Not signed in." };

      // Namespaced by media type: an import batch can carry mixed types (a
      // Letterboxd row might resolve to a series, not a film), and external
      // ids are only unique per (user, media_type) — see migration 0001.
      const key = (mt: string, id: string) => `${mt}:${id}`;
      const existingKeys = new Set(items.map((i) => key(i.media_type, i.external_id)));
      const seen = new Set<string>();
      const now = new Date().toISOString();
      const rows: BacklogItem[] = [];
      for (const input of inputs) {
        const k = key(input.mediaType, input.externalId);
        if (existingKeys.has(k) || seen.has(k)) continue;
        seen.add(k);
        const status = input.status ?? "backlog";
        rows.push({
          id: crypto.randomUUID(),
          media_type: input.mediaType,
          external_id: input.externalId,
          title: input.title,
          cover_url: input.coverUrl,
          release_year: input.releaseYear,
          genres: input.genres,
          meta: input.meta,
          status,
          rating: input.rating ?? null,
          review: input.review?.trim() ? input.review.trim() : null,
          is_private: false,
          is_favorite: false,
          started_at: input.startedAt ?? null,
          progress: input.progress ?? null,
          hours_played: input.hoursPlayed ?? null,
          notes: null,
          pinned_at: null,
          created_at: now,
          updated_at: now,
          completed_at:
            status === "completed" ? (input.completedAt ?? input.startedAt ?? now) : null,
        });
      }
      const skipped = inputs.length - rows.length;
      if (rows.length === 0) return { added: 0, skipped, error: null };

      // Rows for another media type still get written below (a Letterboxd
      // import can resolve some titles to series), but only this hook's own
      // media type is merged into local state — otherwise a series row would
      // briefly render on the Movies page until the next fetch sorts it out.
      const CHUNK = 200;
      const inserted: BacklogItem[] = [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("items")
          .insert(chunk.map((r) => ({ ...r, user_id: userId })));
        if (error) {
          const committedSoFar = inserted.filter((r) => r.media_type === mediaType);
          if (committedSoFar.length) commit([...committedSoFar, ...items]);
          return { added: inserted.length, skipped, error: error.message };
        }
        inserted.push(...chunk);
      }
      commit([...inserted.filter((r) => r.media_type === mediaType), ...items]);
      return { added: inserted.length, skipped, error: null };
    },
    [items, userId, mediaType, commit],
  );

  const update = useCallback(
    (id: string, patch: UpdatePatch) => {
      const now = new Date().toISOString();
      const fields: Record<string, unknown> = { updated_at: now };
      if (patch.status !== undefined) {
        fields.status = patch.status;
        const existing = items.find((i) => i.id === id);
        fields.completed_at =
          patch.status === "completed"
            ? (existing?.completed_at ?? now)
            : null;
        // Once a title moves out of the backlog, the "out now" nudge is done.
        if (patch.status !== "backlog" && existing?.meta?._outNow) {
          const { _outNow: _dropped, ...rest } = existing.meta;
          fields.meta = rest;
        }
      }
      if (patch.rating !== undefined) fields.rating = patch.rating;
      if (patch.review !== undefined) {
        fields.review = patch.review?.trim() ? patch.review.trim() : null;
      }
      if (patch.is_private !== undefined) fields.is_private = patch.is_private;
      if (patch.started_at !== undefined) fields.started_at = patch.started_at;
      if (patch.is_favorite !== undefined) fields.is_favorite = patch.is_favorite;
      if (patch.progress !== undefined) fields.progress = patch.progress;
      if (patch.hours_played !== undefined) fields.hours_played = patch.hours_played;
      if (patch.notes !== undefined) {
        fields.notes = patch.notes?.trim() ? patch.notes.trim() : null;
      }
      if (patch.pinned_at !== undefined) fields.pinned_at = patch.pinned_at;

      // Only one favourite per section — clear any other before setting this one.
      const claimingFavorite = patch.is_favorite === true;

      const previous = items;
      commit(
        items.map((i) => {
          if (i.id === id) return { ...i, ...fields } as BacklogItem;
          if (claimingFavorite && i.is_favorite) return { ...i, is_favorite: false };
          return i;
        }),
      );

      (async () => {
        if (claimingFavorite && userId) {
          await supabase
            .from("items")
            .update({ is_favorite: false })
            .eq("user_id", userId)
            .eq("media_type", mediaType)
            .eq("is_favorite", true)
            .neq("id", id);
        }
        const { error } = await supabase.from("items").update(fields).eq("id", id);
        if (error) {
          commit(previous);
          toast("error", "Couldn't save your changes — check your connection.");
        }
      })();
    },
    [items, userId, mediaType, commit],
  );

  /**
   * Merge freshly-fetched source details into an item (cover, year, genres,
   * scores). Flags `_outNow` when a previously-upcoming title has released.
   */
  const applyDetails = useCallback(
    (id: string, fresh: { coverUrl: string | null; year: number | null; genres: string[]; meta: ItemMeta }) => {
      const existing = items.find((i) => i.id === id);
      if (!existing) return;
      const currentYear = new Date().getFullYear();
      const wasUpcoming =
        existing.release_year != null && existing.release_year > currentYear;
      const nowReleased =
        fresh.year != null && fresh.year <= currentYear;
      const meta: ItemMeta = {
        ...existing.meta,
        ...fresh.meta,
        _refreshedAt: new Date().toISOString(),
        _outNow: (wasUpcoming && nowReleased) || existing.meta?._outNow || undefined,
      };
      const fields = {
        cover_url: fresh.coverUrl ?? existing.cover_url,
        release_year: fresh.year ?? existing.release_year,
        genres: fresh.genres.length ? fresh.genres : existing.genres,
        meta,
      };
      commit(items.map((i) => (i.id === id ? { ...i, ...fields } : i)));
      supabase
        .from("items")
        .update(fields)
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.warn("Refresh sync failed", error);
        });
    },
    [items, commit],
  );

  const remove = useCallback(
    (id: string) => {
      const previous = items;
      commit(items.filter((i) => i.id !== id));
      supabase
        .from("items")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            commit(previous);
            toast("error", "Couldn't remove that — check your connection.");
          }
        });
    },
    [items, commit],
  );

  return { items, ready, loadError, add, bulkAdd, update, remove, applyDetails };
}

/**
 * Insert one item into the signed-in user's library, outside any section hook
 * (used by the recommendations grid). Started/status default in the DB.
 */
export async function addItemToLibrary(
  input: AddInput,
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    media_type: input.mediaType,
    external_id: input.externalId,
    title: input.title,
    cover_url: input.coverUrl,
    release_year: input.releaseYear,
    genres: input.genres,
    meta: input.meta,
  });
  if (error) {
    if (error.code === "23505") return { error: "duplicate" };
    return { error: error.message };
  }
  return { error: null };
}

/* ---------- backup ---------- */

/** Downloads the whole cloud library as a JSON backup file. */
export async function exportBacklog() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const items = (data ?? []).map(({ user_id: _user, ...rest }) => rest);
  const blob = new Blob([JSON.stringify(items, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Replaces the cloud library with the contents of a backup file. */
export async function importBacklog(
  text: string,
  userId: string,
): Promise<{ count: number } | { error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "Couldn't read that file." };
  }
  if (!Array.isArray(parsed)) {
    return { error: "That file doesn't look like a Backlog backup." };
  }
  const valid = parsed.filter(looksLikeItem);

  const { error: deleteError } = await supabase
    .from("items")
    .delete()
    .eq("user_id", userId);
  if (deleteError) return { error: deleteError.message };

  if (valid.length) {
    const { error: insertError } = await supabase
      .from("items")
      .insert(valid.map((i) => ({ ...i, user_id: userId })));
    if (insertError) return { error: insertError.message };
  }
  return { count: valid.length };
}
