"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { statusLabel, type Section } from "@/lib/sections";
import { formatDate } from "@/lib/format";
import type { BacklogItem } from "@/lib/types";
import { StarRating } from "./StarRating";

export const STATUS_DOT: Record<BacklogItem["status"], string> = {
  backlog: "bg-line-strong",
  in_progress: "bg-accent",
  completed: "bg-sage",
  dropped: "bg-muted/50",
};

/** "Coming soon" for unreleased titles; "Out now" once a refresh sees release. */
export function releaseBadge(item: BacklogItem): { label: string; cls: string } | null {
  if (item.release_year != null && item.release_year > new Date().getFullYear()) {
    return { label: "Coming soon", cls: "bg-paper/90 text-accent-hover" };
  }
  if (item.meta?._outNow && item.status === "backlog") {
    return { label: "Out now", cls: "bg-sage text-white" };
  }
  return null;
}

export function ItemCard({
  item,
  section,
  index,
  onClick,
}: {
  item: BacklogItem;
  section: Section;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.04, 0.3),
      }}
      whileHover={{ y: -4 }}
      className="group text-left"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-ivory shadow-[0_1px_2px_rgba(38,37,33,0.06)] transition-shadow duration-300 group-hover:shadow-[0_12px_28px_rgba(38,37,33,0.14)]">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-4xl text-line-strong">
            {item.title.charAt(0)}
          </div>
        )}
        {(() => {
          const badge = releaseBadge(item);
          return badge ? (
            <span
              className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur ${badge.cls}`}
            >
              {badge.label}
            </span>
          ) : null;
        })()}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[item.status]}`}
          />
          <span className="truncate">
            {statusLabel(item.status, section)}
            {item.release_year ? ` · ${item.release_year}` : ""}
          </span>
        </p>
        {item.started_at && (
          <p className="mt-0.5 truncate text-xs text-muted/80">
            {section.startedLabel} {formatDate(item.started_at)}
          </p>
        )}
        {item.rating != null && (
          <div className="mt-1.5">
            <StarRating value={item.rating} size={13} />
          </div>
        )}
      </div>
    </motion.button>
  );
}
