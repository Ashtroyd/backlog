"use client";

import { useState } from "react";
import { searchTitles, useDebouncedSearch } from "@/lib/use-debounced-search";
import type { Section } from "@/lib/sections";
import type { AddInput } from "@/lib/backlog-store";
import type { SearchResult } from "@/lib/types";
import { Modal } from "./Modal";
import { CoverImage } from "./CoverImage";
import { CheckIcon, PlusIcon, SearchIcon, SpinnerIcon } from "./icons";

/** Search-and-add dialog. Stays open after adding so you can queue up several titles. */
export function AddModal({
  open,
  onClose,
  section,
  existingIds,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  section: Section;
  existingIds: Set<string>;
  onAdd: (input: AddInput) => Promise<{ error: string | null }>;
}) {
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

  // Fresh slate every time the dialog opens — adjusted during render rather
  // than in an effect, so the last session's query never paints.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setAdded(new Set());
      setAddError(null);
    }
  }

  // Debounced search against our proxy.
  const q = query.trim();
  const search = useDebouncedSearch(
    open && q.length >= 2 ? `${section.mediaType}:${q}` : null,
    (_, signal) => searchTitles(section.mediaType, q, signal),
  );
  const results = search.value ?? [];
  const searching = search.loading;
  const notice = addError ?? search.error;

  async function handleAdd(r: SearchResult) {
    setAddingId(r.externalId);
    let detail = r;
    // Steam entries (numeric appids) gain genres, platforms and Metacritic on
    // add. IMDb-only entries (tt…) are console titles Steam doesn't carry.
    if (section.mediaType === "game" && /^\d+$/.test(r.externalId)) {
      try {
        const res = await fetch(`/api/detail?type=game&id=${r.externalId}`);
        if (res.ok) {
          const data = await res.json();
          detail = { ...r, ...data.result, externalId: r.externalId };
        }
      } catch {
        // Fall back to the bare search result.
      }
    }

    const { error } = await onAdd({
      mediaType: section.mediaType,
      externalId: detail.externalId,
      title: detail.title,
      coverUrl: detail.coverUrl,
      releaseYear: detail.year,
      genres: detail.genres,
      meta: detail.meta,
    });
    setAddingId(null);
    if (!error || error === "duplicate") {
      setAdded((prev) => new Set(prev).add(r.externalId));
    } else {
      setAddError(error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} sheet>
      {/* iOS search bar: filled field + Cancel. */}
      <div className="flex items-center gap-3 border-b border-line px-4 pb-3 pt-6 sm:px-5 sm:pt-4">
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-[10px] bg-ivory px-3 focus-within:ring-2 focus-within:ring-accent/25">
        <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAddError(null);
          }}
          onKeyDown={(e) => {
            // Enter adds the top result that isn't already in the library.
            if (e.key === "Enter" && results.length > 0) {
              const first = results.find(
                (r) => !existingIds.has(r.externalId) && !added.has(r.externalId),
              );
              if (first) handleAdd(first);
            }
          }}
          placeholder={section.searchPlaceholder}
          aria-label={section.searchPlaceholder}
          className="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
        {searching && (
          <SpinnerIcon className="h-4 w-4 shrink-0 animate-spin text-muted" />
        )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 text-subhead text-accent"
        >
          Done
        </button>
      </div>

      <div className="overflow-y-auto p-2 sm:max-h-[55vh]">
        {notice && (
          <div className="m-2 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-hover">
            {notice}
          </div>
        )}

        {!notice && results.length === 0 && searching && (
          <ul className="divide-y divide-line/70">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex animate-pulse items-center gap-3.5 px-3 py-2.5" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="h-16 w-11 shrink-0 rounded-md bg-ivory" />
                <div className="min-w-0 flex-1">
                  <div className="h-3.5 w-2/3 rounded bg-ivory" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-ivory" />
                </div>
              </li>
            ))}
          </ul>
        )}
        {!notice && results.length === 0 && !searching && (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-muted">
            {query.trim().length < 2
              ? `Start typing — results come from ${section.source} with covers and details filled in. Press Enter to add the top match.`
              : "No results found."}
          </p>
        )}

        <ul className="divide-y divide-line/70">
          {results.map((r) => {
            const inLibrary =
              existingIds.has(r.externalId) || added.has(r.externalId);
            const adding = addingId === r.externalId;
            return (
              <li
                key={r.externalId}
                className="flex items-center gap-3.5 px-3 py-2.5"
              >
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ivory">
                  <CoverImage src={r.coverUrl} title={r.title} sizes="44px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-subhead font-medium text-ink">
                    {r.title}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[
                      r.year,
                      r.genres.join(", "),
                      r.meta.metacritic ? `Metacritic ${r.meta.metacritic}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(r)}
                  disabled={inLibrary || adding}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-footnote font-medium transition-colors ${
                    inLibrary
                      ? "bg-sage-soft text-sage"
                      : "border border-line text-ink hover:border-line-strong hover:bg-ivory"
                  }`}
                >
                  {inLibrary ? (
                    <>
                      <CheckIcon className="h-3.5 w-3.5" /> Added
                    </>
                  ) : adding ? (
                    <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <PlusIcon className="h-3.5 w-3.5" /> Add
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
