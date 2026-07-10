"use client";

import { useEffect, useState } from "react";
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());


  // Fresh slate every time the dialog opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setNotice(null);
      setAdded(new Set());
    }
  }, [open]);

  // Debounced search against our proxy.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setNotice(null);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?type=${section.mediaType}&q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) {
          setNotice(data.message ?? "Search failed — try again.");
          setResults([]);
        } else {
          setNotice(null);
          setResults(data.results);
        }
        setSearching(false);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setNotice("Search failed — try again.");
          setSearching(false);
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, section.mediaType]);

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
      setNotice(error);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={section.searchPlaceholder}
          className="w-full bg-transparent text-lg text-ink placeholder:text-muted/70 focus:outline-none"
        />
        {searching && (
          <SpinnerIcon className="h-4 w-4 shrink-0 animate-spin text-muted" />
        )}
      </div>

      <div className="max-h-[55vh] overflow-y-auto p-2">
        {notice && (
          <div className="m-2 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-hover">
            {notice}
          </div>
        )}

        {!notice && results.length === 0 && (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-muted">
            {query.trim().length < 2
              ? `Start typing — results come from ${section.source} with covers and details filled in.`
              : searching
                ? "Searching…"
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
                  <p className="truncate text-[15px] font-medium text-ink">
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
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
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
