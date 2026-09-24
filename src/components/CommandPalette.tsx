"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addItemToLibrary, useAuth } from "@/lib/backlog-store";
import { onCommandPaletteOpen } from "@/lib/command-palette-bus";
import { searchTitles, useDebouncedSearch } from "@/lib/use-debounced-search";
import { SECTIONS, SECTION_SLUGS, type SectionSlug } from "@/lib/sections";
import type { SearchResult } from "@/lib/types";
import { Modal } from "./Modal";
import { CoverImage } from "./CoverImage";
import {
  ChatIcon,
  CheckIcon,
  FilmIcon,
  GamepadIcon,
  PlusIcon,
  SearchIcon,
  SharedIcon,
  SparklesIcon,
  SpinnerIcon,
  TvIcon,
  UsersIcon,
} from "./icons";

const SECTION_ICON: Record<SectionSlug, (p: { className?: string }) => React.ReactNode> = {
  games: (p) => <GamepadIcon {...p} />,
  movies: (p) => <FilmIcon {...p} />,
  series: (p) => <TvIcon {...p} />,
  anime: (p) => <SparklesIcon {...p} />,
};

const NAV_ITEMS = [
  { href: "/friends", label: "Friends", icon: UsersIcon },
  { href: "/messages", label: "Messages", icon: ChatIcon },
  { href: "/shared", label: "Shared backlog", icon: SharedIcon },
];

type Hit = { slug: SectionSlug; result: SearchResult };

/**
 * Cmd/Ctrl+K: jump to a page or search-and-add a title across every media
 * type at once, without navigating to a section first.
 */
export function CommandPalette() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => onCommandPaletteOpen(() => setOpen(true)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Fresh slate every time the palette opens — adjusted during render, so
  // the last query never paints.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setAdded(new Set());
    }
  }

  // Debounced search across all four sources at once.
  const q = query.trim();
  const search = useDebouncedSearch(open && q.length >= 2 ? q : null, (key, signal) =>
    Promise.all(
      SECTION_SLUGS.map((slug) =>
        searchTitles(SECTIONS[slug].mediaType, key, signal).then(
          (results) => results.slice(0, 4).map((result): Hit => ({ slug, result })),
          (err) => {
            // One source failing shouldn't sink the others.
            if (signal.aborted) throw err;
            return [];
          },
        ),
      ),
    ).then((perSlug) => perSlug.flat()),
  );
  const hits = search.value;
  const searching = search.loading;

  async function handleAdd(hit: Hit) {
    if (!userId) return;
    setAddingId(hit.result.externalId);
    const { error } = await addItemToLibrary({
      mediaType: SECTIONS[hit.slug].mediaType,
      externalId: hit.result.externalId,
      title: hit.result.title,
      coverUrl: hit.result.coverUrl,
      releaseYear: hit.result.year,
      genres: hit.result.genres,
      meta: hit.result.meta,
    });
    setAddingId(null);
    if (!error || error === "duplicate") {
      setAdded((prev) => new Set(prev).add(hit.result.externalId));
    }
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const showNav = query.trim().length < 2;

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games, movies, series, anime…"
          aria-label="Quick search"
          className="w-full bg-transparent text-lg text-ink placeholder:text-muted"
        />
        {searching && <SpinnerIcon className="h-4 w-4 shrink-0 animate-spin text-muted" />}
        <kbd className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-caption2 text-muted sm:block">
          Esc
        </kbd>
      </div>

      <div className="max-h-[55vh] overflow-y-auto p-2">
        {showNav && (
          <ul className="divide-y divide-line/70">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <button
                  type="button"
                  onClick={() => go(href)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-ivory"
                >
                  <Icon className="h-4 w-4 text-muted" />
                  {label}
                </button>
              </li>
            ))}
            {SECTION_SLUGS.map((slug) => {
              const Icon = SECTION_ICON[slug];
              return (
                <li key={slug}>
                  <button
                    type="button"
                    onClick={() => go(`/${slug}`)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-ivory"
                  >
                    <Icon className="h-4 w-4 text-muted" />
                    Go to {SECTIONS[slug].label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!showNav && hits == null && !searching && (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-muted">
            Keep typing to search games, movies, series and anime at once.
          </p>
        )}

        {!showNav && hits && hits.length === 0 && !searching && (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-muted">
            No results found.
          </p>
        )}

        {!showNav && hits && hits.length > 0 && (
          <ul className="divide-y divide-line/70">
            {hits.map((hit) => {
              const isAdded = added.has(hit.result.externalId);
              const adding = addingId === hit.result.externalId;
              const Icon = SECTION_ICON[hit.slug];
              return (
                <li
                  key={`${hit.slug}:${hit.result.externalId}`}
                  className="flex items-center gap-3.5 px-3 py-2.5"
                >
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ivory">
                    <CoverImage src={hit.result.coverUrl} title={hit.result.title} sizes="44px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-subhead font-medium text-ink">{hit.result.title}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted">
                      <Icon className="h-3 w-3" />
                      {SECTIONS[hit.slug].label}
                      {hit.result.year ? ` · ${hit.result.year}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(hit)}
                    disabled={isAdded || adding}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-footnote font-medium transition-colors ${
                      isAdded
                        ? "bg-sage-soft text-sage"
                        : "border border-line text-ink hover:border-line-strong hover:bg-ivory"
                    }`}
                  >
                    {isAdded ? (
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
        )}
      </div>
    </Modal>
  );
}
