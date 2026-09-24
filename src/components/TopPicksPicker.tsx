"use client";

import { useState } from "react";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import { saveTopPicks, type TopPick } from "@/lib/top-picks";
import { toast } from "@/lib/toast-bus";
import type { BacklogItem } from "@/lib/types";
import { Modal } from "./Modal";
import { CoverImage } from "./CoverImage";
import { CheckIcon, PlusIcon, SearchIcon, SpinnerIcon, XIcon } from "./icons";

/** Lets the user hand-pick up to 5 titles from their own library to feature on the homescreen this month. */
export function TopPicksPicker({
  open,
  items,
  initial,
  userId,
  month,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The user's whole library, across all media types. */
  items: BacklogItem[];
  initial: TopPick[];
  userId: string;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<BacklogItem[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Fresh slate every time the dialog opens, seeded from the current picks.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(initial.map((p) => p.item));
      setQuery("");
    }
  }

  function toggle(item: BacklogItem) {
    setSelected((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev.filter((i) => i.id !== item.id);
      if (prev.length >= 5) return prev;
      return [...prev, item];
    });
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await saveTopPicks(userId, month, selected.map((i) => i.id));
    setSaving(false);
    if (error) {
      toast("error", "Couldn't save your picks — check your connection.");
      return;
    }
    toast("success", "Top picks updated.");
    onSaved();
  }

  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => !q || i.title.toLowerCase().includes(q));

  return (
    <Modal open={open} onClose={onClose} sheet>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">This month&apos;s top picks</h2>
          <p className="mt-0.5 text-sm text-muted">Choose up to 5 — any mix of games, movies, series, anime.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-3 border-b border-line px-5 py-4">
        {Array.from({ length: 5 }, (_, i) => selected[i]).map((item, i) =>
          item ? (
            <div key={item.id} className="group relative w-14 shrink-0">
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-ivory">
                <CoverImage src={item.cover_url} title={item.title} sizes="56px" />
              </div>
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-label={`Remove ${item.title}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper shadow-sm"
              >
                <XIcon className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : (
            <div
              key={i}
              className="flex aspect-[2/3] w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted"
            >
              {i + 1}
            </div>
          ),
        )}
      </div>

      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library…"
          aria-label="Search your library"
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted"
        />
      </div>

      <div className="max-h-[45vh] overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-muted">
            {items.length === 0 ? "Add some titles to your library first." : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-line/70">
            {visible.map((item) => {
              const chosen = selected.some((i) => i.id === item.id);
              const full = !chosen && selected.length >= 5;
              return (
                <li key={item.id} className="flex items-center gap-3.5 px-3 py-2.5">
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-ivory">
                    <CoverImage src={item.cover_url} title={item.title} sizes="40px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-subhead font-medium text-ink">{item.title}</p>
                    <p className="truncate text-xs text-muted">
                      {SECTION_BY_MEDIA[item.media_type].label}
                      {item.release_year ? ` · ${item.release_year}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    disabled={full}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-footnote font-medium transition-colors disabled:opacity-40 ${
                      chosen
                        ? "bg-sage-soft text-sage"
                        : "border border-line text-ink hover:border-line-strong hover:bg-ivory"
                    }`}
                  >
                    {chosen ? (
                      <>
                        <CheckIcon className="h-3.5 w-3.5" /> Chosen
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-3.5 w-3.5" /> Choose
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <span className="text-sm text-muted">{selected.length} of 5 chosen</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-80"
        >
          {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
      </div>
    </Modal>
  );
}
