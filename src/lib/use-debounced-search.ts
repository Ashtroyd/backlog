"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { SearchResult } from "./types";

type Settled<T> = { key: string; value: T } | { key: string; error: string };

/**
 * Runs `run(key)` once `key` has stopped changing for `delay` ms, aborting
 * anything still in flight. A null key means "nothing to search" and clears
 * the result. Whether it's loading is derived from which key the last result
 * belongs to, so callers never reset search state by hand.
 *
 * While a new key loads, `value` keeps the previous result on screen (as a
 * search field does) — `loading` says it's on its way out.
 */
export function useDebouncedSearch<T>(
  key: string | null,
  run: (key: string, signal: AbortSignal) => Promise<T>,
  delay = 350,
): { value: T | null; error: string | null; loading: boolean } {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const runLatest = useEffectEvent(run);

  // Clearing the field drops the old result, so the next search starts clean.
  if (key === null && settled !== null) setSettled(null);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      runLatest(key, controller.signal).then(
        (value) => {
          if (!controller.signal.aborted) setSettled({ key, value });
        },
        (err) => {
          if (controller.signal.aborted) return;
          setSettled({
            key,
            error: err instanceof Error ? err.message : "Search failed — try again.",
          });
        },
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, delay]);

  if (key === null || settled === null) {
    return { value: null, error: null, loading: key !== null };
  }
  const fresh = settled.key === key;
  return {
    value: "value" in settled ? settled.value : null,
    error: fresh && "error" in settled ? settled.error : null,
    loading: !fresh,
  };
}

/** One media type's search through our proxy; throws the proxy's message on failure. */
export async function searchTitles(
  mediaType: string,
  q: string,
  signal: AbortSignal,
): Promise<SearchResult[]> {
  const res = await fetch(
    `/api/search?type=${mediaType}&q=${encodeURIComponent(q)}`,
    { signal },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Search failed — try again.");
  return data.results ?? [];
}
