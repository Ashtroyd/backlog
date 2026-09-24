"use client";

import Link from "next/link";
import { motion } from "motion/react";

export type Segment = { href: string; label: string; active: boolean; badge?: number };

/**
 * iOS-style segmented control whose segments are links — used to switch
 * between sibling pages (Library: Games · Movies · Series · Anime; Friends:
 * People · Messages · Shared). The white thumb slides between segments.
 */
export function SegmentedNav({
  id,
  label,
  segments,
}: {
  /** Unique per control, so each one's sliding thumb animates independently. */
  id: string;
  label: string;
  segments: Segment[];
}) {
  return (
    <nav
      aria-label={label}
      className="flex w-full rounded-[10px] bg-ivory p-0.5 sm:max-w-md"
    >
      {segments.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.active ? "page" : undefined}
          className={`relative flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-footnote font-medium transition-colors ${
            s.active ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {s.active && (
            <motion.span
              layoutId={`segment-thumb-${id}`}
              className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]"
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            />
          )}
          <span className={`relative ${s.active ? "font-semibold" : ""}`}>
            {s.label}
          </span>
          {!!s.badge && s.badge > 0 && (
            <span className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-caption2 font-semibold text-white">
              {s.badge > 9 ? "9+" : s.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
