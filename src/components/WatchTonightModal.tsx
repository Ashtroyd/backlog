"use client";

import { useEffect, useState } from "react";
import { fetchAllMyItems, useAuth, type UpdatePatch } from "@/lib/backlog-store";
import type { BacklogItem } from "@/lib/types";
import { EpisodeTracker } from "./EpisodeTracker";
import { Modal } from "./Modal";
import { XIcon } from "./icons";

export function WatchTonightModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (item: BacklogItem, patch: UpdatePatch) => Promise<{ error: string | null; fields: Record<string, unknown> }>;
}) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<BacklogItem[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const selected = items?.find((item) => item.id === selectedId);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchAllMyItems(userId).then((rows) => {
      if (alive) setItems(rows.filter((item) => item.media_type === "series" || item.media_type === "anime")
        .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress") || a.title.localeCompare(b.title)));
    }, () => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [userId, revision]);

  async function track(patch: UpdatePatch) {
    if (!selected || saving) return { error: "Choose a show first." };
    setSaving(true);
    try {
      const result = await onSave(selected, patch);
      if (!result.error) setItems((rows) => rows?.map((item) => item.id === selected.id ? { ...item, ...result.fields } as BacklogItem : item) ?? null);
      return result;
    } finally { setSaving(false); }
  }
  return <Modal open onClose={() => { if (!saving) onClose(); }} sheet>
    <div className="px-5 py-6 sm:px-7">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-display text-2xl font-bold text-ink">Watched tonight</h2><p className="mt-1 text-subhead text-muted">Pick a show and log where you got to.</p></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close watched tonight" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-ivory disabled:opacity-50"><XIcon className="h-5 w-5" /></button>
      </div>
      {loadError ? <p role="alert" className="mt-5 text-subhead text-muted">Couldn’t load your shows. <button type="button" className="min-h-11 text-accent underline" onClick={() => { setLoadError(false); setRevision((value) => value + 1); }}>Try again</button></p>
        : items == null ? <p role="status" className="mt-5 text-subhead text-muted">Loading your shows…</p>
        : items.length === 0 ? <p className="mt-5 text-subhead text-muted">Add a series or anime to your library to start logging.</p>
        : <label className="mt-5 flex flex-col gap-2 text-subhead text-muted">Show
          <select aria-label="Show" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={saving} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <option value="">Choose a show</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.title}{item.status === "in_progress" ? " · Watching" : ""}</option>)}
          </select>
        </label>}
      {selected && <EpisodeTracker key={selected.id} item={selected} disabled={saving} onTrack={track} />}
    </div>
  </Modal>;
}
