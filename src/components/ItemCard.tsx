"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { STATUS_ORDER, statusLabel, type Section } from "@/lib/sections";
import { formatDate, todayISODate } from "@/lib/format";
import type { BacklogItem, ItemStatus } from "@/lib/types";
import type { UpdatePatch } from "@/lib/backlog-store";
import { StarRating } from "./StarRating";
import { HeartIcon } from "./icons";

export const STATUS_DOT: Record<BacklogItem["status"], string> = {
  backlog: "bg-line-strong",
  in_progress: "bg-accent",
  completed: "bg-sage",
  dropped: "bg-muted/50",
};

/** Games tagged live-service show that instead of "Playing" — they have no real "completed" state. */
function displayStatusLabel(item: BacklogItem, section: Section): string {
  if (item.live_service && item.status === "in_progress") return "Live Service";
  return statusLabel(item.status, section);
}

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
  onUpdate,
}: {
  item: BacklogItem;
  section: Section;
  index: number;
  onClick: () => void;
  /** Omit for a read-only view (e.g. a friend's library) to hide the quick-action overlay. */
  onUpdate?: (id: string, patch: UpdatePatch) => void;
}) {
  /** Mirrors DetailModal's convenience: first move out of the backlog defaults the start date to today. */
  function quickSetStatus(next: ItemStatus) {
    if (!onUpdate) return;
    const patch: UpdatePatch = { status: next };
    if ((next === "in_progress" || next === "completed") && !item.started_at) {
      patch.started_at = todayISODate();
    }
    onUpdate(item.id, patch);
  }

  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.04, 0.3),
      }}
      whileHover={{ y: -4 }}
      className="group cursor-pointer text-left"
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

        {onUpdate && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(item.id, { is_favorite: !item.is_favorite });
              }}
              title={item.is_favorite ? "Remove from favourites" : "Add to favourites"}
              aria-label={item.is_favorite ? "Remove from favourites" : "Add to favourites"}
              className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 backdrop-blur transition-opacity ${
                item.is_favorite
                  ? "text-accent opacity-100"
                  : "text-muted opacity-0 hover:text-ink group-hover:opacity-100"
              }`}
            >
              <HeartIcon className="h-3.5 w-3.5" fill={item.is_favorite ? "currentColor" : "none"} />
            </button>

            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-1.5 pb-1.5 pt-5 opacity-0 transition-opacity group-hover:opacity-100">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    quickSetStatus(s);
                  }}
                  title={statusLabel(s, section)}
                  aria-label={`Mark as ${statusLabel(s, section)}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full transition-transform hover:scale-125 ${
                      item.status === s ? STATUS_DOT[s] : "bg-white/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[item.status]}`}
          />
          <span className="truncate">
            {displayStatusLabel(item, section)}
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
    </motion.div>
  );
}
