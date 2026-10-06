"use client";

import { useEffect, useState } from "react";
import { offlineGet, offlineSet } from "./offline-store";
import { useOnline } from "./use-online";
import { useAuth } from "./backlog-store";
import type { BacklogItem } from "./types";
import type { EpisodeAvailability } from "./episode-data";

type Saved = { availability: EpisodeAvailability; checkedAt: number };
// Serialize sources across cards; Jikan has a small shared request budget.
let queue: Promise<unknown> = Promise.resolve();
export const episodeNotificationsKey = (userId: string) => `backlog:episode-notifications:v1:${userId}`;

export function useEpisodes(item: BacklogItem) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const online = useOnline();
  const key = `episodes:v1:${userId}:${item.media_type}:${item.external_id}`;
  const [result, setResult] = useState<{ key: string; data: EpisodeAvailability } | null>(null);
  useEffect(() => {
    if (!userId || !["anime", "series"].includes(item.media_type) || !/^\d+$/.test(item.external_id)) return;
    let alive = true;
    const refresh = async () => {
      const saved = await offlineGet<Saved>(key);
      if (!alive) return;
      if (saved) setResult({ key, data: saved.availability });
      if (!online || document.visibilityState !== "visible" || (saved && Date.now() - saved.checkedAt < 3_600_000)) return;
      const work = async () => {
        if (!alive) return;
        try {
          const response = await fetch(`/api/episodes?type=${item.media_type}&id=${item.external_id}`, { signal: AbortSignal.timeout(35_000) });
          if (!response.ok) return;
          const { availability } = await response.json() as { availability: EpisodeAvailability | null };
          if (!availability || !alive) return;
          await offlineSet(key, { availability, checkedAt: Date.now() });
          if (!alive) return;
          setResult({ key, data: availability });
          // First check establishes a baseline, not a flood of old episodes.
          if (saved && availability.aired > saved.availability.aired && availability.aired > (item.progress ?? 0)) {
            let enabled = false;
            try { enabled = localStorage.getItem(episodeNotificationsKey(userId)) === "on"; } catch {}
            if (enabled && "Notification" in window && Notification.permission === "granted" && "serviceWorker" in navigator) {
              const registration = await navigator.serviceWorker.getRegistration();
              await registration?.showNotification("New episode available", {
                body: item.title, icon: "/icon-192.png", tag: `episode-${item.id}`,
                data: { url: `/${item.media_type === "anime" ? "anime" : "series"}?item=${item.id}` },
              });
            }
          }
        } catch { /* Keep the previous availability on a source/network failure. */ }
        finally { await new Promise((resolve) => setTimeout(resolve, 1100)); }
      };
      queue = queue.then(work, work);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3_600_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [key, online, userId, item.media_type, item.external_id, item.progress, item.id, item.title]);
  return result?.key === key ? result.data : null;
}
