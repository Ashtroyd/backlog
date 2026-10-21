"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, type UpdatePatch } from "@/lib/backlog-store";
import { supabase } from "@/lib/supabase";
import { formatDate, todayISODate } from "@/lib/format";
import { episodeLabel, nextWatchEpisodes, type WatchEpisode, type WatchInput, type WatchSession } from "@/lib/watch-history";
import type { BacklogItem } from "@/lib/types";

const inputClass = "min-h-11 rounded-lg border border-line bg-surface px-3 text-subhead text-ink focus-visible:outline-2 focus-visible:outline-accent";

export function EpisodeTracker({ item, disabled, onTrack }: {
  item: BacklogItem; disabled: boolean;
  onTrack: (patch: UpdatePatch, progress: number) => Promise<{ error: string | null }>;
}) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [catalogue, setCatalogue] = useState<WatchEpisode[] | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(item.media_type === "series");
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const [limit, setLimit] = useState(20);
  const [count, setCount] = useState("1");
  const [date, setDate] = useState(todayISODate);
  const [rewatch, setRewatch] = useState(false);
  const [rewatchOrdinal, setRewatchOrdinal] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<{ signature: string; input: WatchInput } | null>(null);
  const saving = useRef(false);
  const progress = item.progress ?? 0;
  const total = catalogue?.length || item.meta?.episodes || null;

  useEffect(() => {
    if (item.media_type !== "series") return;
    const controller = new AbortController();
    fetch(`/api/episodes/catalogue?type=series&id=${encodeURIComponent(item.external_id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const result = await response.json();
        if (!Array.isArray(result.episodes)) throw new Error("Invalid list");
        if (!controller.signal.aborted) setCatalogue(result.episodes);
      }).catch(() => { /* Number-only logging remains available when the source is unavailable. */ })
      .finally(() => { if (!controller.signal.aborted) setCatalogueLoading(false); });
    return () => controller.abort();
  }, [item.media_type, item.external_id]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void supabase.from("episode_watch_sessions").select("id,item_id,watched_on,episodes,is_rewatch,progress_before,progress_after,created_at")
      .eq("user_id", userId).eq("item_id", item.id).order("created_at", { ascending: false }).limit(limit)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setHistoryState("error");
        else { setSessions(data ?? []); setHistoryState("ready"); }
      }, () => { if (alive) setHistoryState("error"); });
    return () => { alive = false; };
  }, [item.id, item.updated_at, userId, revision, limit]);

  let episodes: WatchEpisode[] = [];
  let validation: string | null = null;
  try {
    if (rewatch) {
      const ordinal = Number(rewatchOrdinal);
      if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > progress) throw new Error("Choose an episode you have already watched.");
      episodes = [catalogue?.find((episode) => episode.ordinal === ordinal) ?? { ordinal, season: null, number: ordinal, title: null }];
    } else episodes = nextWatchEpisodes(progress, Number(count), catalogue, total);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || date > todayISODate())
      throw new Error("Choose today or an earlier watch date.");
  } catch (cause) { validation = cause instanceof Error ? cause.message : "Check the episode count."; }
  const next = catalogue?.find((episode) => episode.ordinal === progress + 1);
  const last = catalogue?.find((episode) => episode.ordinal === progress);
  const range = episodes.length ? `${episodeLabel(episodes[0])}${episodes.length > 1 ? ` → ${episodeLabel(episodes.at(-1)!)}` : ""}` : null;
  const historyLabel = (episode: WatchEpisode) => episodeLabel(episode.season == null ? catalogue?.find((row) => row.ordinal === episode.ordinal) ?? episode : episode);
  const blocked = disabled || busy;

  async function log() {
    if (blocked || saving.current || validation) return;
    saving.current = true; setBusy(true); setError(null); setNotice(null);
    const signature = JSON.stringify({ date, episodes, rewatch });
    if (pending.current?.signature !== signature) pending.current = {
      signature, input: { requestId: crypto.randomUUID(), watchedOn: date, episodes, rewatch },
    };
    try {
      const result = await onTrack({ watch: pending.current.input }, progress + (rewatch ? 0 : episodes.length));
      if (result.error) { setError(readableError(result.error)); return; }
      pending.current = null;
      setNotice(`${episodes.length === 1 ? "Episode" : `${episodes.length} episodes`} logged for ${formatDate(date)}${rewatch ? " · rewatch" : ""}.`);
      setCount("1"); setHistoryState("loading"); setRevision((value) => value + 1);
    } catch { setError("Couldn't save your watch log. Your choices are still here—try again."); }
    finally { saving.current = false; setBusy(false); }
  }

  async function undo(latest: WatchSession) {
    if (blocked || saving.current) return;
    saving.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const result = await onTrack({ undoWatch: latest.id }, latest.progress_before);
      if (result.error) setError(readableError(result.error));
      else { pending.current = null; setHistoryState("loading"); setRevision((value) => value + 1); setNotice("Latest watch log undone."); }
    } catch { setError("Couldn't undo this log. Try again."); }
    finally { saving.current = false; setBusy(false); }
  }

  return <section aria-label="Episode tracking" className="mt-6 rounded-xl border border-line bg-ivory/70">
    <div className="border-b border-line px-4 py-4">
      <p className="text-footnote uppercase tracking-wide text-muted">Your place</p>
      <p className="mt-1 text-lg font-medium text-ink">{next ? `Up next · ${episodeLabel(next)}` : total && progress >= total ? "Caught up" : `Up next · Episode ${progress + 1}`}</p>
      {next?.title && <p className="text-subhead text-muted">{next.title}</p>}
      <p className="mt-1 text-footnote text-muted">{last ? `Last watched · ${episodeLabel(last)} · ` : ""}{progress} episodes watched</p>
      {item.media_type === "series" && !catalogue?.length && <p className="mt-1 text-footnote text-muted">{catalogueLoading ? "Loading season details…" : "Season details unavailable. You can still log by episode count."}</p>}
    </div>
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-subhead font-semibold text-ink">Watched tonight</h3>
        <label className="flex min-h-11 items-center gap-2 text-subhead text-muted">
          <input type="checkbox" checked={rewatch} disabled={blocked || progress < 1} onChange={(event) => { setRewatch(event.target.checked); setError(null); }} className="accent-accent" /> Rewatch
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        {!(rewatch && catalogue?.length) && <label className="flex min-w-0 flex-1 flex-col gap-1 text-footnote text-muted">{rewatch ? "Episode to rewatch" : "Episodes watched"}
          <input className={`${inputClass} w-full`} type="number" inputMode="numeric" min={1} max={rewatch ? progress : Math.min(100, total ? Math.max(0, total - progress) : 100)} step={1}
            value={rewatch ? rewatchOrdinal : count} disabled={blocked} onChange={(event) => rewatch ? setRewatchOrdinal(event.target.value) : setCount(event.target.value)} />
        </label>}
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-footnote text-muted">Watched on
          <input className={`${inputClass} w-full min-w-0`} type="date" value={date} max={todayISODate()} disabled={blocked} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
      {!!catalogue?.length && <label className="flex flex-col gap-1 text-footnote text-muted">{rewatch ? "Choose an episode" : "Last episode watched"}
        <select aria-label={rewatch ? "Choose an episode" : "Last episode watched"} className={`${inputClass} w-full`} value={rewatch ? rewatchOrdinal : String(progress + Number(count))} disabled={blocked}
          onChange={(event) => rewatch ? setRewatchOrdinal(event.target.value) : setCount(String(Number(event.target.value) - progress))}>
          <option value="" disabled>Choose an episode</option>
          {[...new Set(catalogue.map((episode) => episode.season))].map((season) => <optgroup key={season ?? "unknown"} label={season == null ? "Episodes" : `Season ${season}`}>
            {catalogue.filter((episode) => episode.season === season && (rewatch ? episode.ordinal <= progress : episode.ordinal > progress && episode.ordinal <= progress + 100))
              .map((episode) => <option key={episode.ordinal} value={episode.ordinal}>{episodeLabel(episode)}{episode.title ? ` · ${episode.title}` : ""}</option>)}
          </optgroup>)}
        </select>
      </label>}
      {range && !validation && <p className="text-subhead text-ink">{range}{rewatch ? " · rewatch, keeps your current place" : ""}</p>}
      {validation && <p className="text-footnote text-muted">{validation}</p>}
      <button type="button" onClick={() => void log()} disabled={blocked || !!validation}
        className="min-h-11 w-full rounded-lg bg-accent px-4 text-subhead font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
        {busy ? "Saving…" : rewatch ? "Log rewatch" : `Log ${episodes.length || 1} ${episodes.length <= 1 ? "episode" : "episodes"}`}
      </button>
      {disabled && !busy && <p className="text-footnote text-muted">Save or discard your other edits before logging episodes.</p>}
      {error && <p role="alert" className="text-subhead text-red-700">{error}</p>}
      {notice && <p role="status" className="text-subhead text-accent">{notice}</p>}
    </div>
    <div className="border-t border-line px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-subhead font-semibold text-ink">Watch history</h3><span className="text-footnote text-muted">Only you can see this</span>
      </div>
      {historyState === "loading" && <p role="status" className="mt-2 text-subhead text-muted">Loading watch history…</p>}
      {historyState === "error" && <p role="alert" className="mt-2 text-subhead text-muted">Couldn’t load watch history. <button type="button" onClick={() => { setHistoryState("loading"); setRevision((value) => value + 1); }} className="min-h-11 text-accent underline">Try again</button></p>}
      {historyState === "ready" && sessions.length === 0 && <p className="mt-2 text-subhead text-muted">Your next watch goes here. Existing progress has no recorded watch dates.</p>}
      {historyState === "ready" && <ol className="mt-2 divide-y divide-line">
        {sessions.map((log, index) => <li key={log.id} className="py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-subhead text-ink">{historyLabel(log.episodes[0])}{log.episodes.length > 1 ? ` → ${historyLabel(log.episodes.at(-1)!)}` : ""}{log.is_rewatch ? " · Rewatch" : ""}</p>
              <p className="text-footnote text-muted">{formatDate(log.watched_on)} · {log.episodes.length} {log.episodes.length === 1 ? "episode" : "episodes"}</p>
            </div>
            {index === 0 && <button type="button" disabled={blocked || progress !== log.progress_after} onClick={() => void undo(log)} className="min-h-11 shrink-0 px-2 text-subhead text-accent disabled:opacity-40" aria-label="Undo latest watch log">Undo</button>}
          </div>
          {log.episodes.length === 1 && log.episodes[0].title && <p className="text-footnote text-muted">{log.episodes[0].title}</p>}
          {log.episodes.length > 1 && <details className="mt-1 text-footnote text-muted"><summary className="cursor-pointer py-2">View episodes</summary><ul>{log.episodes.map((episode) => <li key={episode.ordinal} className="py-1">{historyLabel(episode)}{episode.title ? ` · ${episode.title}` : ""}</li>)}</ul></details>}
        </li>)}
      </ol>}
      {historyState === "ready" && sessions.length >= limit && <button type="button" onClick={() => setLimit((value) => value + 20)} className="min-h-11 text-subhead text-accent">Show older logs</button>}
    </div>
  </section>;
}

function readableError(message: string) {
  if (/schema cache|does not exist|could not find.*function/i.test(message)) return "Episode logging isn't available yet. Your progress hasn't changed.";
  if (/Progress changed|already|Choose|Invalid|Title unavailable|Log the next|request has/i.test(message)) return message;
  return "Couldn't save your watch log. Your choices are still here—try again.";
}
