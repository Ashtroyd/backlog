"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { addItemToLibrary } from "@/lib/backlog-store";
import { SECTIONS, SECTION_SLUGS, type SectionSlug } from "@/lib/sections";
import type { SearchResult } from "@/lib/types";
import { CoverImage } from "./CoverImage";
import { TrendingDetailModal } from "./TrendingDetailModal";
import { CheckIcon, FilmIcon, GamepadIcon, SparklesIcon, TrendingUpIcon, TvIcon } from "./icons";

const TOGGLE_ICON: Record<SectionSlug, (props: { className?: string }) => React.ReactNode> = {
  games: (p) => <GamepadIcon {...p} />,
  movies: (p) => <FilmIcon {...p} />,
  series: (p) => <TvIcon {...p} />,
  anime: (p) => <SparklesIcon {...p} />,
};

/** What's popular right now, per media type — a lightweight discovery shelf, not tied to the user's own library. */
export function TrendingSection({ userId }: { userId: string | null }) {
  const [slug, setSlug] = useState<SectionSlug>("games");
  const [load, setLoad] = useState<{
    slug: SectionSlug;
    results: SearchResult[];
    notice: string | null;
  } | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // `load` tags each response with the slug it answers, so a stale response
  // for a slug the user has since switched away from is simply ignored.
  useEffect(() => {
    let alive = true;
    const section = SECTIONS[slug];
    fetch(`/api/trending?type=${section.mediaType}`)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        setLoad(
          data.error
            ? { slug, results: [], notice: data.message ?? "Couldn't load trending titles." }
            : { slug, results: data.results ?? [], notice: null },
        );
      })
      .catch(() => {
        if (alive) {
          setLoad({ slug, results: [], notice: "Couldn't load trending titles — try again." });
        }
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const loading = load?.slug !== slug;
  const results = loading ? null : load?.results ?? null;
  const notice = loading ? null : load?.notice ?? null;
  const selectedSection = selected ? SECTIONS[slug] : null;

  async function handleAdd(r: SearchResult) {
    if (!userId) return { error: "Not signed in." };
    const section = SECTIONS[slug];
    const { error } = await addItemToLibrary({
      mediaType: section.mediaType,
      externalId: r.externalId,
      title: r.title,
      coverUrl: r.coverUrl,
      releaseYear: r.year,
      genres: r.genres,
      meta: r.meta,
    });
    if (!error || error === "duplicate") {
      setAdded((prev) => new Set(prev).add(r.externalId));
    }
    return { error };
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-serif text-xl font-semibold text-ink">
          <TrendingUpIcon className="h-4.5 w-4.5 text-accent" />
          Currently trending
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {SECTION_SLUGS.map((s) => {
            const active = s === slug;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSlug(s)}
                className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "text-paper" : "text-muted hover:bg-ivory hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="trending-pill"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {TOGGLE_ICON[s]({ className: "h-3.5 w-3.5" })}
                  {SECTIONS[s].label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-hover">
          {notice}
        </p>
      )}

      {!notice && results == null && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-28 shrink-0 animate-pulse sm:w-32" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="aspect-[2/3] rounded-xl bg-ivory" />
              <div className="mt-2.5 h-3.5 w-4/5 rounded bg-ivory" />
            </div>
          ))}
        </div>
      )}

      {!notice && results && results.length === 0 && (
        <p className="text-sm text-muted">Nothing trending right now — check back later.</p>
      )}

      {!notice && results && results.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {results.map((r) => {
            const isAdded = added.has(r.externalId);
            return (
              <button
                key={r.externalId}
                type="button"
                onClick={() => setSelected(r)}
                className="group w-28 shrink-0 text-left sm:w-32"
                title={r.title}
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-ivory shadow-[0_1px_2px_rgba(38,37,33,0.06)] transition-shadow duration-300 group-hover:shadow-[0_12px_28px_rgba(38,37,33,0.14)]">
                  <CoverImage
                    src={r.coverUrl}
                    title={r.title}
                    sizes="144px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {isAdded && (
                    <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-sage-soft text-sage shadow-sm">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <p className="mt-2.5 truncate px-0.5 text-sm font-medium text-ink">{r.title}</p>
                {r.year && <p className="mt-0.5 truncate px-0.5 text-xs text-muted">{r.year}</p>}
              </button>
            );
          })}
        </div>
      )}

      <TrendingDetailModal
        result={selected}
        section={selectedSection}
        alreadyAdded={selected ? added.has(selected.externalId) : false}
        onClose={() => setSelected(null)}
        onAdd={handleAdd}
      />
    </section>
  );
}
