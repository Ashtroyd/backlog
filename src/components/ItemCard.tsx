"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "@/lib/toast-bus";
import { motion } from "motion/react";
import { STATUS_ORDER, statusLabel, type Section } from "@/lib/sections";
import { todayISODate } from "@/lib/format";
import type { BacklogItem, ItemStatus } from "@/lib/types";
import type { UpdatePatch } from "@/lib/backlog-store";
import { StarRating } from "./StarRating";
import { PopoverMenu, useMenu, type MenuSections } from "./PopoverMenu";
import { CheckIcon, HeartIcon, PinIcon, TrashIcon } from "./icons";

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

/** Share of a title that's done, when there's a real total to measure against. */
function progressFraction(item: BacklogItem): number | null {
  const total = item.meta?.episodes;
  if (item.status !== "in_progress" || !total || total <= 0) return null;
  return Math.min(1, Math.max(0, (item.progress ?? 0) / total));
}

/** The single line under the title — whatever matters most for this state. */
function contextLine(item: BacklogItem, section: Section): React.ReactNode {
  if (item.status === "completed") {
    return item.rating != null ? (
      <StarRating value={item.rating} size={11} />
    ) : (
      "Completed"
    );
  }
  if (item.status === "in_progress") {
    const total = item.meta?.episodes;
    if (item.progress != null && (section.mediaType === "series" || section.mediaType === "anime"))
      return total ? `Ep ${item.progress} of ${total}` : `Ep ${item.progress}`;
    if (item.hours_played != null)
      return `${displayStatusLabel(item, section)} · ${item.hours_played} h`;
    return displayStatusLabel(item, section);
  }
  if (item.status === "backlog") {
    return releaseBadge(item)?.label ?? item.release_year ?? "Up next";
  }
  return statusLabel(item.status, section);
}

/** Verb for moving a title into a status, as a menu row. */
function actionLabel(status: ItemStatus, section: Section): string {
  switch (status) {
    case "backlog":
      return "Move to Backlog";
    case "in_progress":
      return `Start ${section.inProgressLabel}`;
    case "on_hold":
      return "Put On Hold";
    case "completed":
      return "Mark Completed";
    case "dropped":
      return "Drop";
  }
}

const LONG_PRESS_MS = 450;

/**
 * Poster card: artwork, title and one context line. Status reads off the
 * cover itself — a progress bar while watching, a check once completed.
 * Everything else is a long-press (touch), right-click, or the ⋯ button
 * that appears on hover.
 */
export function ItemCard({
  item,
  section,
  index,
  onClick,
  onUpdate,
  onRemove,
  sharedCover = true,
}: {
  item: BacklogItem;
  section: Section;
  index: number;
  onClick: () => void;
  /** Omit for a read-only view (e.g. a friend's library) to hide quick actions. */
  onUpdate?: (
    id: string,
    patch: UpdatePatch,
  ) => Promise<{ error: string | null }>;
  onRemove?: (item: BacklogItem) => void;
  /** Animate this cover into the detail sheet. Off for duplicate copies of a
      title (the pinned shelf) — two live elements can't share one layoutId. */
  sharedCover?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const menu = useMenu();
  const [fromTouch, setFromTouch] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  void index;

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
    const patch: UpdatePatch = { status: next };
    if ((next === "in_progress" || next === "completed") && !item.started_at) {
      patch.started_at = todayISODate();
    }
    void save(patch);
  }

  const sections: MenuSections = onUpdate
    ? [
        STATUS_ORDER.filter((s) => s !== item.status).map((s) => ({
          label: actionLabel(s, section),
          onSelect: () => quickSetStatus(s),
        })),
        [
          {
            label: item.is_favorite ? "Remove from Favourites" : "Favourite",
            icon: (
              <HeartIcon
                className="h-[18px] w-[18px]"
                fill={item.is_favorite ? "currentColor" : "none"}
              />
            ),
            onSelect: () => void save({ is_favorite: !item.is_favorite }),
          },
          {
            label: item.pinned_at ? "Unpin from Up Next" : "Pin to Up Next",
            icon: <PinIcon className="h-[18px] w-[18px]" />,
            onSelect: () =>
              void save({
                pinned_at: item.pinned_at ? null : new Date().toISOString(),
              }),
          },
        ],
        onRemove
          ? [
              {
                label: "Remove from Library",
                icon: <TrashIcon className="h-[18px] w-[18px]" />,
                destructive: true,
                onSelect: () => onRemove(item),
              },
            ]
          : [],
      ]
    : [];

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!onUpdate || e.pointerType === "mouse") return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setFromTouch(true);
      navigator.vibrate?.(10);
      // Like iOS: the menu hangs below the lifted card (or above it), lined
      // up with whichever side of the screen the card is on.
      const el = coverRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        menu.openFrom(el, r.left + r.width / 2 > window.innerWidth / 2 ? "right" : "left");
      }
      pressTimer.current = null;
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = pressStart.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancelPress();
  }

  const fraction = progressFraction(item);
  const badge = releaseBadge(item);
  const lifted = menu.open && fromTouch;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, scale: lifted ? 1.04 : 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2 }}
      className={`group relative min-w-0 text-left ${lifted ? "z-[61]" : ""}`}
      onContextMenu={(e) => {
        if (!onUpdate) return;
        e.preventDefault();
        cancelPress();
        setFromTouch(false);
        menu.openAt(e.clientX, e.clientY);
      }}
    >
      <div
        ref={coverRef}
        className="relative aspect-[2/3] select-none overflow-hidden rounded-lg bg-ivory shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-shadow duration-300 [-webkit-touch-callout:none] group-hover:shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
      >
        <button
          type="button"
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onClick();
          }}
          aria-label={`Open ${item.title}`}
          className="absolute inset-0 z-10 rounded-lg focus-visible:outline-offset-4"
        />
        <motion.div
          layoutId={sharedCover ? `cover-${item.id}` : undefined}
          className="absolute inset-0"
        >
          {item.cover_url ? (
            <Image
              src={item.cover_url}
              alt=""
              fill
              draggable={false}
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 22vw, 180px"
              className="object-cover transition-[filter] duration-300 group-hover:brightness-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-4xl text-line-strong">
              {item.title.charAt(0)}
            </div>
          )}
        </motion.div>

        {badge && (
          <span
            className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-caption2 font-semibold shadow-sm backdrop-blur ${badge.cls}`}
          >
            {badge.label}
          </span>
        )}

        {item.is_favorite && (
          <span
            aria-label="Favourite"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-opacity group-hover:opacity-0"
          >
            <HeartIcon className="h-3.5 w-3.5" fill="currentColor" />
          </span>
        )}

        {/* Status on the artwork, TV-app style. */}
        {fraction != null ? (
          <span
            aria-label={`${Math.round(fraction * 100)}% watched`}
            className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/35 backdrop-blur"
          >
            <span
              className="block h-full rounded-full bg-white"
              style={{ width: `${Math.max(fraction * 100, 4)}%` }}
            />
          </span>
        ) : item.status === "in_progress" ? (
          <span
            aria-label={displayStatusLabel(item, section)}
            className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent shadow"
          />
        ) : item.status === "completed" ? (
          <span
            aria-label="Completed"
            className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-sage shadow"
          >
            <CheckIcon className="h-3 w-3" />
          </span>
        ) : null}

        {onUpdate && (
          <button
            type="button"
            aria-label={`More actions for ${item.title}`}
            aria-haspopup="menu"
            onClick={(e) => {
              setFromTouch(false);
              menu.openFrom(e.currentTarget, "right");
            }}
            className={`absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-md transition-opacity after:absolute after:-inset-2 focus-visible:opacity-100 group-hover:opacity-100 ${
              menu.open ? "opacity-100" : ""
            } [@media(hover:none)]:hidden`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <circle cx="5.5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="18.5" cy="12" r="1.7" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <p className="truncate text-footnote font-medium text-ink">{item.title}</p>
        <div className="mt-0.5 truncate text-caption2 text-muted">
          {contextLine(item, section)}
        </div>
      </div>

      <PopoverMenu
        anchor={menu.anchor}
        onClose={menu.close}
        sections={sections}
        label={`Actions for ${item.title}`}
        dim={fromTouch}
      />
    </motion.div>
  );
}
