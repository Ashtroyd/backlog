"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "@/lib/toast-bus";
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
  on_hold: "bg-muted",
};

/** Games tagged live-service show that instead of "Playing" — they have no real "completed" state. */
function displayStatusLabel(item: BacklogItem, section: Section): string {
  if (item.live_service && item.status === "in_progress") return "Live Service";
  return statusLabel(item.status, section);
}

/** "Coming soon" for unreleased titles; "Out now" once a refresh sees release. */
export function releaseBadge(
  item: BacklogItem,
): { label: string; cls: string } | null {
  if (
    item.release_year != null &&
    item.release_year > new Date().getFullYear()
  ) {
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
  dataTour,
}: {
  item: BacklogItem;
  section: Section;
  index: number;
  onClick: () => void;
  /** Omit for a read-only view (e.g. a friend's library) to hide the quick-action overlay. */
  onUpdate?: (
    id: string,
    patch: UpdatePatch,
  ) => Promise<{ error: string | null }>;
  /** Tags this card as a feature-tour target — set on the first card of the main grid only. */
  dataTour?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function save(patch: UpdatePatch) {
    if (!onUpdate || busy) return;
    setBusy(true);
    try {
      const result = await onUpdate(item.id, patch);
      if (result.error) toast("error", "Couldn't save that change. Try again.");
    } catch {
      toast("error", "Couldn't save that change. Try again.");
    } finally {
      setBusy(false);
    }
  }
  /** Mirrors DetailModal's convenience: first move out of the backlog defaults the start date to today. */
  function quickSetStatus(next: ItemStatus) {
    if (!onUpdate) return;
    const patch: UpdatePatch = { status: next };
    if ((next === "in_progress" || next === "completed") && !item.started_at) {
      patch.started_at = todayISODate();
    }
    void save(patch);
  }

  return (
    <motion.div
      layout
      data-tour={dataTour}
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
        <button
          type="button"
          onClick={onClick}
          aria-label={`Open ${item.title}`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-offset-4"
        />
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-4xl text-line-strong">
            {item.title.charAt(0)}
          </div>
        )}
        {(() => {
          const badge = releaseBadge(item);
          return badge ? (
            <span
              className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-caption2 font-semibold shadow-sm backdrop-blur ${badge.cls}`}
            >
              {badge.label}
            </span>
          ) : null;
        })()}

        {onUpdate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ is_favorite: !item.is_favorite })}
            aria-label={
              item.is_favorite
                ? `Remove ${item.title} from favourites`
                : `Add ${item.title} to favourites`
            }
            aria-pressed={item.is_favorite}
            className={`absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-paper/90 backdrop-blur ${item.is_favorite ? "text-accent" : "text-muted hover:text-ink"} disabled:opacity-50`}
          >
            <HeartIcon
              className="h-4 w-4"
              fill={item.is_favorite ? "currentColor" : "none"}
            />
          </button>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        {onUpdate ? (
          <select
            aria-label={`Status for ${item.title}`}
            value={item.status}
            disabled={busy}
            onChange={(e) => quickSetStatus(e.target.value as ItemStatus)}
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink disabled:opacity-50"
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status, section)}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            {displayStatusLabel(item, section)}
          </p>
        )}
        {(item.release_year || item.live_service) && (
          <p className="mt-1 text-xs text-muted">
            {[item.live_service ? "Live service" : null, item.release_year]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {item.started_at && (
          <p className="mt-0.5 truncate text-xs text-muted">
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
