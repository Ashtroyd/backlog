"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { fetchConnections, type Connection } from "@/lib/social";
import { addToSharedBacklog } from "@/lib/shared-backlog";
import { SECTIONS, SECTION_SLUGS, type SectionSlug } from "@/lib/sections";
import { toast } from "@/lib/toast-bus";
import type { SearchResult } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { CoverImage } from "@/components/CoverImage";
import { Avatar } from "@/components/Avatar";
import { CheckIcon, ChevronLeftIcon, PlusIcon, SearchIcon, SpinnerIcon } from "@/components/icons";

/** Search a title, then pick which friend(s) to plan it with — each pick adds one joint shared-backlog row. */
export function AddSharedModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;

  const [slug, setSlug] = useState<SectionSlug>("games");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [friends, setFriends] = useState<Connection[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sharedWith, setSharedWith] = useState<Set<string>>(new Set());

  const section = SECTIONS[slug];

  // Fresh slate every time the dialog opens.
  useEffect(() => {
    if (open) {
      setSlug("games");
      setQuery("");
      setResults([]);
      setNotice(null);
      setPicked(null);
      setFriends(null);
      setSharedWith(new Set());
    }
  }, [open]);

  // Debounced search against our proxy — same endpoint the section Add dialog uses.
  useEffect(() => {
    if (!open || picked) return;
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
  }, [query, open, section.mediaType, picked]);

  function choose(r: SearchResult) {
    setPicked(r);
    setSharedWith(new Set());
    if (myId) {
      fetchConnections(myId)
        .then((c) => setFriends(c.friends))
        .catch(() => setFriends([]));
    }
  }

  async function share(f: Connection) {
    if (!picked || !myId) return;
    setBusyId(f.profile.id);
    const { error } = await addToSharedBacklog(myId, f.profile.id, {
      mediaType: section.mediaType,
      externalId: picked.externalId,
      title: picked.title,
      coverUrl: picked.coverUrl,
      releaseYear: picked.year,
      genres: picked.genres,
      meta: picked.meta,
    });
    setBusyId(null);
    if (!error || error === "duplicate") {
      setSharedWith((prev) => new Set(prev).add(f.profile.id));
      onAdded();
    } else {
      toast("error", error);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      {!picked ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-line px-5 py-3">
            {SECTION_SLUGS.map((s) => {
              const active = s === slug;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSlug(s);
                    setQuery("");
                    setResults([]);
                    setNotice(null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-ivory text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {SECTIONS[s].label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={section.searchPlaceholder}
              aria-label={section.searchPlaceholder}
              className="w-full bg-transparent text-lg text-ink placeholder:text-muted/70"
            />
            {searching && (
              <SpinnerIcon className="h-4 w-4 shrink-0 animate-spin text-muted" />
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto p-2">
            {notice && (
              <div className="m-2 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-hover">
                {notice}
              </div>
            )}
            {!notice && results.length === 0 && !searching && (
              <p className="px-6 py-10 text-center text-sm leading-relaxed text-muted">
                {query.trim().length < 2
                  ? `Search for a ${section.singular} to plan with a friend.`
                  : "No results found."}
              </p>
            )}

            <ul className="divide-y divide-line/70">
              {results.map((r) => (
                <li key={r.externalId} className="flex items-center gap-3.5 px-3 py-2.5">
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ivory">
                    <CoverImage src={r.coverUrl} title={r.title} sizes="44px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">{r.title}</p>
                    <p className="truncate text-xs text-muted">
                      {[r.year, r.genres.join(", ")].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-ivory"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Pick
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="p-5">
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="mb-3 flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back to search
          </button>

          <div className="flex items-center gap-3">
            <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ivory">
              <CoverImage src={picked.coverUrl} title={picked.title} sizes="44px" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-lg font-semibold text-ink">
                {picked.title}
              </h2>
              <p className="text-sm text-muted">Plan this with a friend</p>
            </div>
          </div>

          <div className="mt-4 max-h-[45vh] overflow-y-auto">
            {friends === null ? (
              <div className="flex justify-center py-8">
                <SpinnerIcon className="h-5 w-5 animate-spin text-muted" />
              </div>
            ) : friends.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                Add some friends first to build a shared backlog with them.
              </p>
            ) : (
              <ul className="space-y-1">
                {friends.map((f) => {
                  const shared = sharedWith.has(f.profile.id);
                  return (
                    <li key={f.friendshipId} className="flex items-center gap-3 px-1 py-1.5">
                      <Avatar profile={f.profile} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {f.profile.display_name}
                        </p>
                        <p className="truncate text-xs text-muted">@{f.profile.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => share(f)}
                        disabled={shared || busyId === f.profile.id}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                          shared
                            ? "bg-sage-soft text-sage"
                            : "bg-accent text-white hover:bg-accent-hover"
                        }`}
                      >
                        {busyId === f.profile.id ? (
                          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : shared ? (
                          <>
                            <CheckIcon className="h-3.5 w-3.5" /> Added
                          </>
                        ) : (
                          "Add"
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
