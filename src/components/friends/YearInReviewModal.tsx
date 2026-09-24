"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { SECTIONS, SECTION_SLUGS } from "@/lib/sections";
import type { BacklogItem } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { StarRating } from "@/components/StarRating";
import { CoverImage } from "@/components/CoverImage";
import { XIcon } from "@/components/icons";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** completed_at is a full timestamptz (unlike started_at's plain date), so
 * it needs its own formatter rather than lib/format's formatDate. */
function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function computeYearStats(items: BacklogItem[], year: number) {
  const completed = items.filter(
    (i) => i.status === "completed" && i.completed_at && new Date(i.completed_at).getFullYear() === year,
  );

  const byType: Record<string, number> = { game: 0, movie: 0, series: 0, anime: 0 };
  for (const i of completed) byType[i.media_type]++;

  const totalHours = completed
    .filter((i) => i.media_type === "game")
    .reduce((sum, i) => sum + (i.hours_played ?? 0), 0);

  const totalEpisodes = completed
    .filter((i) => i.media_type === "series" || i.media_type === "anime")
    .reduce((sum, i) => sum + (i.progress ?? 0), 0);

  const rated = completed.filter((i) => i.rating != null);
  const avgRating =
    rated.length > 0 ? rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length : null;

  const topRated = [...rated].sort((a, b) => {
    if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
    return new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime();
  })[0] ?? null;

  const genreCounts = new Map<string, number>();
  for (const i of completed) {
    for (const g of i.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const monthCounts = Array(12).fill(0);
  for (const i of completed) monthCounts[new Date(i.completed_at!).getMonth()]++;
  const busiestMonthIdx = monthCounts.every((n) => n === 0)
    ? null
    : monthCounts.indexOf(Math.max(...monthCounts));

  const sorted = [...completed].sort(
    (a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime(),
  );
  const first = sorted[0] ?? null;
  const last = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  return {
    completed,
    byType,
    totalHours,
    totalEpisodes,
    avgRating,
    topRated,
    topGenres,
    busiestMonthIdx,
    busiestMonthCount: busiestMonthIdx != null ? monthCounts[busiestMonthIdx] : 0,
    first,
    last,
  };
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function YearInReviewModal({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: BacklogItem[];
}) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const i of items) {
      if (i.status === "completed" && i.completed_at) {
        set.add(new Date(i.completed_at).getFullYear());
      }
    }
    return [...set].sort((a, b) => b - a);
  }, [items]);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() => (years.includes(currentYear) ? currentYear : years[0] ?? currentYear));

  const stats = useMemo(() => computeYearStats(items, year), [items, year]);

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Your year in review</h2>
            {years.length > 1 && (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label="Year"
                className="mt-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm text-body"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
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

        {stats.completed.length === 0 ? (
          <p className="mt-8 py-12 text-center text-sm leading-relaxed text-muted">
            Nothing marked completed in {year} yet — finish something and come back.
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            <motion.div {...fadeUp(0)} className="rounded-2xl border border-line bg-surface p-6 text-center">
              <p className="font-display text-5xl font-semibold tracking-tight text-ink">
                {stats.completed.length}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                title{stats.completed.length === 1 ? "" : "s"} completed in {year}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {SECTION_SLUGS.map((slug) => {
                  const n = stats.byType[SECTIONS[slug].mediaType];
                  if (!n) return null;
                  return (
                    <span key={slug} className="rounded-full bg-ivory px-2.5 py-1 text-xs text-body">
                      {SECTIONS[slug].label} {n}
                    </span>
                  );
                })}
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.totalHours > 0 && (
                <motion.div {...fadeUp(0.05)} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="font-display text-2xl font-semibold text-ink">
                    {Math.round(stats.totalHours)}
                  </p>
                  <p className="text-xs text-muted">hours played</p>
                </motion.div>
              )}
              {stats.totalEpisodes > 0 && (
                <motion.div {...fadeUp(0.1)} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="font-display text-2xl font-semibold text-ink">{stats.totalEpisodes}</p>
                  <p className="text-xs text-muted">episodes watched</p>
                </motion.div>
              )}
              <motion.div {...fadeUp(0.15)} className="rounded-2xl border border-line bg-surface p-4">
                {stats.avgRating != null ? (
                  <>
                    <div className="flex h-8 items-center">
                      <StarRating value={Math.round(stats.avgRating * 2) / 2} size={16} />
                    </div>
                    <p className="mt-1 text-xs text-muted">avg rating · {stats.avgRating.toFixed(1)}</p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-2xl font-semibold text-muted">–</p>
                    <p className="text-xs text-muted">avg rating</p>
                  </>
                )}
              </motion.div>
              {stats.busiestMonthIdx != null && (
                <motion.div {...fadeUp(0.2)} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="font-display text-2xl font-semibold text-ink">
                    {MONTH_NAMES[stats.busiestMonthIdx]}
                  </p>
                  <p className="text-xs text-muted">
                    busiest month · {stats.busiestMonthCount} completed
                  </p>
                </motion.div>
              )}
              {stats.topGenres.length > 0 && (
                <motion.div {...fadeUp(0.25)} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-sm font-medium leading-snug text-ink">
                    {stats.topGenres.join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-muted">top genres</p>
                </motion.div>
              )}
            </div>

            {stats.topRated && (
              <motion.div
                {...fadeUp(0.3)}
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4"
              >
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-ivory">
                  <CoverImage src={stats.topRated.cover_url} title={stats.topRated.title} sizes="64px" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Favourite of {year}
                  </p>
                  <p className="mt-1 truncate font-display text-lg font-semibold text-ink">
                    {stats.topRated.title}
                  </p>
                  {stats.topRated.rating != null && (
                    <div className="mt-1">
                      <StarRating value={stats.topRated.rating} size={15} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {stats.first && (
              <motion.div {...fadeUp(0.35)} className="flex items-center justify-between gap-3 text-sm">
                <p className="text-muted">
                  First finished:{" "}
                  <span className="font-medium text-ink">{stats.first.title}</span>{" "}
                  <span className="text-muted">({formatTimestamp(stats.first.completed_at)})</span>
                </p>
              </motion.div>
            )}
            {stats.last && (
              <motion.div {...fadeUp(0.4)} className="flex items-center justify-between gap-3 text-sm">
                <p className="text-muted">
                  Last finished:{" "}
                  <span className="font-medium text-ink">{stats.last.title}</span>{" "}
                  <span className="text-muted">({formatTimestamp(stats.last.completed_at)})</span>
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
