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

export type UpdatePatch = {
  status?: ItemStatus;
  rating?: number | null;
  review?: string | null;
  is_private?: boolean;
  started_at?: string | null;
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

export function useBacklog(mediaType: MediaType) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [items, setItems] = useState<BacklogItem[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        started_at: null,
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
      setItems((prev) => [item, ...prev]);
      return { error: null };
    },
    [items, userId],
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
      }
      if (patch.rating !== undefined) fields.rating = patch.rating;
      if (patch.review !== undefined) {
        fields.review = patch.review?.trim() ? patch.review.trim() : null;
      }
      if (patch.is_private !== undefined) fields.is_private = patch.is_private;
      if (patch.started_at !== undefined) fields.started_at = patch.started_at;
      setItems((prev) =>
        prev.map((i) => (i.id === id ? ({ ...i, ...fields } as BacklogItem) : i)),
      );
      supabase
        .from("items")
        .update(fields)
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.warn("Update failed to sync", error);
        });
    },
    [items],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    supabase
      .from("items")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Delete failed to sync", error);
      });
  }, []);

  return { items, ready, loadError, add, update, remove };
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
