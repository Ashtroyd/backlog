"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAllMyItems } from "@/lib/backlog-store";
import { findStarterPicks, rotateStarterPicks, STARTER_MOODS, type StarterPreferences } from "@/lib/start-picker";
import type { BacklogItem } from "@/lib/types";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import { Modal } from "./Modal";
import { CoverImage } from "./CoverImage";

export default function StartPicker({ open, userId, onClose, onChoose }: { open: boolean; userId: string; onClose: () => void; onChoose: (item: BacklogItem) => void }) {
  const [items, setItems] = useState<BacklogItem[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preferences, setPreferences] = useState<StarterPreferences>({ media: "any", minutes: null, mood: "any", includePaused: false });
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchAllMyItems(userId).then((rows) => { if (active) { setItems(rows); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [userId, attempt, open]);
  function change(next: Partial<StarterPreferences>) { setPreferences((current) => ({ ...current, ...next })); setOffset(0); }
  const candidates = useMemo(() => findStarterPicks(items ?? [], preferences), [items, preferences]);
  const picks = rotateStarterPicks(candidates, offset);
  const field = "min-h-11 w-full rounded-[10px] border border-line bg-ivory px-3 text-subhead text-ink";
  return <Modal open={open} onClose={onClose} sheet>
    <div className="p-5 sm:p-7">
      <header className="flex items-start justify-between gap-4"><div><h2 className="font-display text-2xl font-bold tracking-tight text-ink">What should I start?</h2><p className="mt-1 text-footnote text-muted">A few picks from your own backlog.</p></div><button type="button" onClick={onClose} className="min-h-11 px-2 font-medium text-accent">Done</button></header>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="space-y-1 text-footnote font-medium text-body"><span>In the mood for</span><select className={field} value={preferences.media} onChange={(e) => change({ media: e.target.value as StarterPreferences["media"] })}><option value="any">Anything</option><option value="game">A game</option><option value="movie">A film</option><option value="series">A series</option><option value="anime">Anime</option></select></label>
        <label className="space-y-1 text-footnote font-medium text-body"><span>Time available</span><select className={field} value={preferences.minutes ?? "any"} onChange={(e) => change({ minutes: e.target.value === "any" ? null : Number(e.target.value) as 30 | 60 | 120 })}><option value="any">No limit</option><option value="30">30 minutes</option><option value="60">An hour</option><option value="120">Two hours</option></select></label>
      </div>
      <fieldset className="mt-4"><legend className="text-footnote font-medium text-body">What sounds good?</legend><div className="mt-2 flex flex-wrap gap-2">{STARTER_MOODS.map((mood) => <button key={mood.value} type="button" aria-pressed={preferences.mood === mood.value} onClick={() => change({ mood: mood.value })} className={`min-h-11 rounded-full px-3 text-footnote font-medium transition-colors ${preferences.mood === mood.value ? "bg-accent text-white" : "bg-ivory text-body hover:bg-line"}`}>{mood.label}</button>)}</div></fieldset>
      <label className="mt-4 flex min-h-11 items-center gap-2 text-footnote text-body"><input type="checkbox" checked={preferences.includePaused} onChange={(e) => change({ includePaused: e.target.checked })} className="h-4 w-4 accent-accent" />Include paused titles</label>
      <div className="mt-4 border-t border-line pt-4" aria-live="polite" aria-busy={items === null && !error}>
        {error ? <div className="rounded-xl bg-accent-soft p-4 text-subhead text-body"><p>Your library couldn’t load. Check your connection and try again.</p><button type="button" onClick={() => { setError(false); setAttempt((n) => n + 1); }} className="mt-2 min-h-11 font-medium text-accent">Try again</button></div>
          : items === null ? <p className="py-6 text-subhead text-muted">Finding your next pick…</p>
          : !items.some((item) => item.status === "backlog" || item.status === "on_hold") ? <div className="py-5"><p className="font-display text-lg font-bold text-ink">Nothing waiting to start.</p><p className="mt-1 text-subhead text-muted">Add a title to your backlog, then come back for a pick.</p></div>
          : !picks.length ? <div className="py-5"><p className="font-display text-lg font-bold text-ink">No matches for this combination.</p><p className="mt-1 text-subhead text-muted">Try another mood, allow more time, or include paused titles. Mood filters use saved genres; short sessions leave out films.</p><button type="button" onClick={() => { setPreferences({ media: "any", minutes: null, mood: "any", includePaused: true }); setOffset(0); }} className="mt-3 min-h-11 font-medium text-accent">Show all waiting titles</button></div>
          : <><p className="mb-3 text-caption2 font-medium text-muted">{candidates.length} matching {candidates.length === 1 ? "title" : "titles"} · tap a pick to see details</p><div className="space-y-3">{picks.map((pick) => <button type="button" key={pick.item.id} onClick={() => onChoose(pick.item)} className="flex w-full items-start gap-4 rounded-2xl bg-ivory/60 p-3 text-left transition-colors hover:bg-ivory"><div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-line"><CoverImage src={pick.item.cover_url} title={pick.item.title} sizes="64px" /></div><div className="min-w-0 flex-1"><p className="text-caption2 font-medium text-muted">{SECTION_BY_MEDIA[pick.item.media_type].label}</p><h3 className="mt-0.5 font-display text-lg font-bold leading-tight text-ink">{pick.item.title}</h3><p className="mt-1 text-footnote text-body">{pick.reasons.join(" ")}</p><p className="mt-2 text-caption2 leading-relaxed text-muted">{pick.timeNote}</p></div></button>)}</div><button type="button" disabled={candidates.length <= 1} onClick={() => setOffset((value) => value + (candidates.length > 3 ? 3 : 1))} className="mt-4 min-h-11 w-full rounded-xl bg-ivory text-subhead font-medium text-accent disabled:opacity-40">See other picks</button></>}
      </div>
      <p className="mt-4 text-caption2 leading-relaxed text-muted">Uses your saved genres, pinned titles and highly rated favourites. Time is a session guide, not a verified runtime. Titles dated after this year are left out.</p>
    </div>
  </Modal>;
}
