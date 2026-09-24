"use client";

import { SECTIONS, SECTION_SLUGS } from "@/lib/sections";
import type { BacklogItem } from "@/lib/types";
import { StarRating } from "@/components/StarRating";

/** Compact library stats: headline tiles, per-section counts, yearly bars. */
export function StatsPanel({ items }: { items: BacklogItem[] }) {
  if (items.length === 0) return null;

  const completed = items.filter((i) => i.status === "completed");
  const rated = items.filter((i) => i.rating != null);
  const avg =
    rated.length > 0
      ? rated.reduce((a, i) => a + (i.rating ?? 0), 0) / rated.length
      : null;

  const thisYear = new Date().getFullYear();
  const completedIn = (year: number) =>
    completed.filter(
      (i) => i.completed_at && new Date(i.completed_at).getFullYear() === year,
    ).length;

  const years = [4, 3, 2, 1, 0].map((back) => thisYear - back);
  const yearCounts = years.map((y) => ({ year: y, n: completedIn(y) }));
  const maxYear = Math.max(1, ...yearCounts.map((c) => c.n));

  const tiles = [
    { label: "Titles", value: String(items.length) },
    { label: "Completed", value: String(completed.length) },
    { label: `Done in ${thisYear}`, value: String(completedIn(thisYear)) },
  ];

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label}>
            <p className="font-display text-2xl font-bold text-ink">{t.value}</p>
            <p className="text-xs text-muted">{t.label}</p>
          </div>
        ))}
        <div>
          {avg != null ? (
            <>
              <div className="flex h-8 items-center">
                <StarRating value={Math.round(avg * 2) / 2} size={15} />
              </div>
              <p className="text-xs text-muted">
                Avg rating · {avg.toFixed(1)}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-bold text-muted">–</p>
              <p className="text-xs text-muted">Avg rating</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line pt-4">
        {SECTION_SLUGS.map((slug) => {
          const n = items.filter(
            (i) => i.media_type === SECTIONS[slug].mediaType,
          ).length;
          if (n === 0) return null;
          return (
            <span
              key={slug}
              className="rounded-full bg-ivory px-2.5 py-1 text-xs text-body"
            >
              {SECTIONS[slug].label} {n}
            </span>
          );
        })}
      </div>

      {completed.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Completed per year
          </p>
          <div className="flex items-end gap-3">
            {yearCounts.map(({ year, n }) => (
              <div key={year} className="flex flex-col items-center gap-1">
                <span className="text-xs text-body">{n}</span>
                <div
                  className="w-8 rounded-t bg-accent/70"
                  style={{ height: `${8 + (n / maxYear) * 48}px` }}
                />
                <span className="text-caption2 text-muted">{year}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
