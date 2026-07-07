"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BacklogItem,
  ItemMeta,
  ItemStatus,
  MediaType,
} from "./types";

/**
 * Browser-local persistence. The whole library lives under one localStorage
 * key as a flat array; each section filters by media_type.
 */

const STORAGE_KEY = "backlog:v1";

function loadAll(): BacklogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(items: BacklogItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

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
};

export function useBacklog(mediaType: MediaType) {
  // null = not loaded yet (first client render, before localStorage is read).
  const [all, setAll] = useState<BacklogItem[] | null>(null);

  useEffect(() => {
    setAll(loadAll());
  }, []);

  const items = useMemo(
    () =>
      (all ?? [])
        .filter((i) => i.media_type === mediaType)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [all, mediaType],
  );

  const add = useCallback(
    (input: AddInput): { error: string | null } => {
      const current = all ?? loadAll();
      if (
        current.some(
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
        created_at: now,
        updated_at: now,
        completed_at: null,
      };
      const next = [item, ...current];
      saveAll(next);
      setAll(next);
      return { error: null };
    },
    [all],
  );

  const update = useCallback(
    (id: string, patch: UpdatePatch) => {
      const current = all ?? loadAll();
      const now = new Date().toISOString();
      const next = current.map((i) => {
        if (i.id !== id) return i;
        const updated: BacklogItem = { ...i, updated_at: now };
        if (patch.status !== undefined) {
          updated.status = patch.status;
          updated.completed_at =
            patch.status === "completed" ? (i.completed_at ?? now) : null;
        }
        if (patch.rating !== undefined) updated.rating = patch.rating;
        if (patch.review !== undefined) {
          updated.review = patch.review?.trim() ? patch.review.trim() : null;
        }
        return updated;
      });
      saveAll(next);
      setAll(next);
    },
    [all],
  );

  const remove = useCallback(
    (id: string) => {
      const current = all ?? loadAll();
      const next = current.filter((i) => i.id !== id);
      saveAll(next);
      setAll(next);
    },
    [all],
  );

  return { items, ready: all !== null, add, update, remove };
}

/** Downloads the whole library as a JSON backup file. */
export function exportBacklog() {
  const blob = new Blob([JSON.stringify(loadAll(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Replaces the library with the contents of a backup file. */
export function importBacklog(
  text: string,
): { count: number } | { error: string } {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { error: "That file doesn't look like a Backlog backup." };
    }
    const valid = parsed.filter(
      (i) =>
        i &&
        typeof i.id === "string" &&
        typeof i.title === "string" &&
        typeof i.media_type === "string" &&
        typeof i.status === "string",
    );
    saveAll(valid);
    return { count: valid.length };
  } catch {
    return { error: "Couldn't read that file." };
  }
}
