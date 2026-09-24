"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  STATUS_ORDER,
  statusLabel,
  statusLabelFor,
  type Section,
} from "@/lib/sections";
import { useAuth, type UpdatePatch } from "@/lib/backlog-store";
import { fetchAlsoHave, type AlsoHave } from "@/lib/social";
import { hasShareableTake, itemChips } from "@/lib/chips";
import { todayISODate } from "@/lib/format";
import type { BacklogItem, ItemStatus } from "@/lib/types";
import { Modal, SheetDragArea } from "./Modal";
import { PopoverMenu, useMenu } from "./PopoverMenu";
import { StarRating } from "./StarRating";
import { Avatar } from "./Avatar";
import { CommentThread } from "./CommentThread";
import { useConfirm } from "./ConfirmDialog";
import { ShareToFriendModal } from "./ShareToFriendModal";
import { releaseBadge, STATUS_DOT } from "./ItemCard";
import {
  ChevronRightIcon,
  EllipsisCircleIcon,
  EyeOffIcon,
  HeartIcon,
  InfinityIcon,
  PinIcon,
  SendIcon,
  TrashIcon,
  XIcon,
} from "./icons";

/** Settings-style inset grouped list. */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl bg-ivory/70">
      {children}
    </div>
  );
}

function GroupLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <p className="mb-1.5 mt-6 flex items-center gap-1.5 px-4 text-footnote uppercase tracking-wide text-muted">
      {icon}
      {children}
    </p>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-1">
      <span className="shrink-0 text-subhead text-ink">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-1 text-subhead text-muted">
        {children}
      </div>
    </div>
  );
}

const textareaCls =
  "block w-full resize-none bg-transparent px-4 py-3 text-subhead leading-relaxed text-ink outline-none placeholder:text-muted";

/** Details are re-fetched when unreleased, or last refreshed over 30 days ago. */
function isStale(item: BacklogItem): boolean {
  const currentYear = new Date().getFullYear();
  if (item.release_year == null || item.release_year > currentYear) return true;
  const last = item.meta?._refreshedAt
    ? Date.parse(item.meta._refreshedAt)
    : Date.parse(item.created_at);
  return Date.now() - last > 30 * 24 * 60 * 60 * 1000;
}

export function DetailModal({
  item,
  section,
  onClose,
  onUpdate,
  onRemove,
  onRefresh,
}: {
  item: BacklogItem | null;
  section: Section;
  onClose: () => void;
  onUpdate: (
    id: string,
    patch: UpdatePatch,
  ) => Promise<{ error: string | null }>;
  onRemove: (id: string) => Promise<{ error: string | null }>;
  onRefresh?: (
    id: string,
    fresh: {
      coverUrl: string | null;
      year: number | null;
      genres: string[];
      meta: BacklogItem["meta"];
    },
  ) => void;
}) {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;
  const confirm = useConfirm();

  // Keep the last item around so the close animation still has content.
  const [snapshot, setSnapshot] = useState<BacklogItem | null>(item);
  const [status, setStatus] = useState<ItemStatus>("backlog");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [startedAt, setStartedAt] = useState("");
  const [episodes, setEpisodes] = useState("");
  const [hours, setHours] = useState("");
  const [liveService, setLiveService] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [notes, setNotes] = useState("");
  const [currentThoughts, setCurrentThoughts] = useState("");
  const [alsoHave, setAlsoHave] = useState<AlsoHave[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardRequested, setDiscardRequested] = useState(false);
  const draftItem = useRef<BacklogItem | null>(null);

  const moreMenu = useMenu();
  const statusMenu = useMenu();
  const ratingRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) {
      draftItem.current = null;
      return;
    }
    // Source metadata can refresh while typing; only initialise a new editor.
    if (draftItem.current?.id !== item.id) {
      draftItem.current = item;
      setSaving(false);
      setSaveError(null);
      setDiscardRequested(false);
      setSnapshot(item);
      setStatus(item.status);
      setRating(item.rating);
      setReview(item.review ?? "");
      setIsPrivate(item.is_private);
      setIsFavorite(item.is_favorite);
      setStartedAt(item.started_at ?? "");
      setEpisodes(item.progress != null ? String(item.progress) : "");
      setHours(item.hours_played != null ? String(item.hours_played) : "");
      setLiveService(item.live_service);
      setPinned(item.pinned_at != null);
      setNotes(item.notes ?? "");
      setCurrentThoughts(item.current_thoughts ?? "");
    }
  }, [item]);

  /**
   * One-tap changes (status, +1 episode, rating, favourite, pin…) save
   * straight away, like toggles in Settings; only typed fields wait for Save.
   * The snapshot absorbs the saved values so the dirty check stays honest
   * about whatever else is still being edited.
   */
  async function quick(patch: UpdatePatch) {
    if (!item || saving) return;
    if (patch.status !== undefined) setStatus(patch.status);
    if (patch.started_at !== undefined) setStartedAt(patch.started_at ?? "");
    if (patch.progress !== undefined)
      setEpisodes(patch.progress == null ? "" : String(patch.progress));
    if (patch.rating !== undefined) setRating(patch.rating);
    if (patch.is_favorite !== undefined) setIsFavorite(patch.is_favorite);
    if (patch.pinned_at !== undefined) setPinned(patch.pinned_at != null);
    if (patch.live_service !== undefined) setLiveService(patch.live_service);
    if (patch.is_private !== undefined) setIsPrivate(patch.is_private);
    setSaving(true);
    setSaveError(null);
    try {
      const result = await onUpdate(item.id, patch);
      if (result.error)
        setSaveError(
          "That change didn't save. Check your connection, then tap Save.",
        );
      else
        setSnapshot((prev) =>
          prev ? ({ ...prev, ...patch } as BacklogItem) : prev,
        );
    } catch {
      setSaveError(
        "That change didn't save. Check your connection, then tap Save.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Moving out of the backlog for the first time defaults the start date to
  // today (still editable). We never overwrite a date that's already set.
  function chooseStatus(next: ItemStatus) {
    const patch: UpdatePatch = { status: next };
    if ((next === "in_progress" || next === "completed") && !startedAt) {
      patch.started_at = todayISODate();
    }
    void quick(patch);
  }

  /** Put every field back to what's saved. */
  function revert() {
    const o = snapshot;
    if (!o) return;
    setStatus(o.status);
    setRating(o.rating);
    setReview(o.review ?? "");
    setIsPrivate(o.is_private);
    setIsFavorite(o.is_favorite);
    setStartedAt(o.started_at ?? "");
    setEpisodes(o.progress != null ? String(o.progress) : "");
    setHours(o.hours_played != null ? String(o.hours_played) : "");
    setLiveService(o.live_service);
    setPinned(o.pinned_at != null);
    setNotes(o.notes ?? "");
    setCurrentThoughts(o.current_thoughts ?? "");
    setSaveError(null);
    setDiscardRequested(false);
  }

  // Silently refresh stale details from the source while the dialog is open,
  // so unreleased titles pick up covers, years and scores as they firm up.
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!item || !onRefresh || !isStale(item)) return;
    if (refreshedFor.current === item.id) return;
    refreshedFor.current = item.id;
    const url = `/api/refresh?type=${item.media_type}&id=${encodeURIComponent(item.external_id)}&title=${encodeURIComponent(item.title)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.result) {
          onRefresh(item.id, {
            coverUrl: data.result.coverUrl ?? null,
            year: data.result.year ?? null,
            genres: data.result.genres ?? [],
            meta: data.result.meta ?? {},
          });
        }
      })
      .catch(() => {});
  }, [item, onRefresh]);

  // Which friends also have this title?
  useEffect(() => {
    if (!item || !myId) {
      setAlsoHave([]);
      return;
    }
    let alive = true;
    fetchAlsoHave(item.media_type, item.external_id, myId)
      .then((rows) => alive && setAlsoHave(rows))
      .catch(() => alive && setAlsoHave([]));
    return () => {
      alive = false;
    };
  }, [item, myId]);

  const current = item ?? snapshot;

  const isEpisodic =
    section.mediaType === "series" || section.mediaType === "anime";
  const totalEpisodes =
    current?.meta?.episodes && current.meta.episodes > 0
      ? current.meta.episodes
      : null;
  const original = snapshot;
  const dirty =
    !!item &&
    !!original &&
    (status !== original.status ||
      rating !== original.rating ||
      review !== (original.review ?? "") ||
      notes !== (original.notes ?? "") ||
      currentThoughts !== (original.current_thoughts ?? "") ||
      isPrivate !== original.is_private ||
      isFavorite !== original.is_favorite ||
      startedAt !== (original.started_at ?? "") ||
      episodes !==
        (original.progress == null ? "" : String(original.progress)) ||
      hours !==
        (original.hours_played == null ? "" : String(original.hours_played)) ||
      liveService !== original.live_service ||
      pinned !== (original.pinned_at != null));

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function requestClose() {
    if (saving) return;
    if (dirty) setDiscardRequested(true);
    else onClose();
  }

  // A swipe-down with unsaved edits may happen far down the sheet — bring
  // the discard prompt into view.
  useEffect(() => {
    if (discardRequested)
      bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [discardRequested]);

  async function handleSave() {
    if (!current || saving) return;
    const parsedEpisodes =
      episodes.trim() === "" ? null : Math.max(0, Math.floor(Number(episodes)));
    const parsedHours = hours.trim() === "" ? null : Math.max(0, Number(hours));
    if (
      isEpisodic &&
      episodes !== "" &&
      (!Number.isFinite(Number(episodes)) ||
        Number(episodes) < 0 ||
        !Number.isInteger(Number(episodes)) ||
        (totalEpisodes != null && Number(episodes) > totalEpisodes))
    ) {
      setSaveError(
        `Enter a whole episode number from 0${totalEpisodes != null ? ` to ${totalEpisodes}` : " upwards"}.`,
      );
      return;
    }
    if (
      section.mediaType === "game" &&
      hours !== "" &&
      (!Number.isFinite(Number(hours)) || Number(hours) < 0)
    ) {
      setSaveError("Enter a valid number of hours, zero or more.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const draft: UpdatePatch = {
        status,
        rating,
        review,
        notes,
        is_private: isPrivate,
        is_favorite: isFavorite,
        started_at: startedAt || null,
        progress:
          isEpisodic && !Number.isNaN(parsedEpisodes ?? 0)
            ? parsedEpisodes
            : undefined,
        hours_played:
          section.mediaType === "game" && !Number.isNaN(parsedHours ?? 0)
            ? parsedHours
            : undefined,
        live_service: section.mediaType === "game" ? liveService : undefined,
        current_thoughts:
          section.mediaType === "game" ? currentThoughts : undefined,
        // Preserve the original pin time so re-saving doesn't bump it to the
        // front of "Up next" — only a fresh pin gets a new timestamp.
        pinned_at: pinned
          ? (current.pinned_at ?? new Date().toISOString())
          : null,
      };
      // Send only edited fields; saving progress must not rewrite an existing review or favourite.
      const patch = Object.fromEntries(
        Object.entries(draft).filter(([key, value]) => {
          if (value === undefined) return false;
          const before = original?.[key as keyof BacklogItem];
          return typeof value === "string"
            ? value.trim() !== (before ?? "")
            : value !== before;
        }),
      ) as UpdatePatch;
      if (!Object.keys(patch).length) {
        onClose();
        return;
      }
      const result = await onUpdate(current.id, patch);
      if (result.error)
        setSaveError(
          "Your changes are still here. Check your connection and try saving again.",
        );
      else onClose();
    } catch {
      setSaveError(
        "Your changes are still here. Check your connection and try saving again.",
      );
    } finally {
      setSaving(false);
    }
  }

  /** Step the episode counter (saved at once), clamped to [0, total] when known. */
  function stepEpisodes(delta: number) {
    const next = Math.max(0, (Number(episodes) || 0) + delta);
    void quick({
      progress: totalEpisodes != null ? Math.min(next, totalEpisodes) : next,
    });
  }

  async function handleRemove() {
    if (!current) return;
    const ok = await confirm({
      title: `Remove ${current.title}?`,
      message: "It comes off your library along with its rating and review.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const result = await onRemove(current.id);
      if (result.error)
        setSaveError("Couldn't remove this title. Please try again.");
      else onClose();
    } catch {
      setSaveError(
        "Couldn't remove this title. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function scrollToRating() {
    ratingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const chips = itemChips(current);
  const verb = section.inProgressLabel;
  const episodeCount = Number(episodes) || 0;

  type PrimaryKind = "start" | "episode" | "complete" | "rate" | "recommend";
  /** The one obvious next step for this title, like the TV app's Play/Resume. */
  const primary: { kind: PrimaryKind; label: string; detail?: string } | null =
    status === "backlog"
      ? { kind: "start", label: `Start ${verb}` }
      : status === "on_hold" || status === "dropped"
        ? { kind: "start", label: `Resume ${verb}` }
        : status === "in_progress"
          ? isEpisodic &&
            !(totalEpisodes != null && episodeCount >= totalEpisodes)
            ? {
                kind: "episode",
                label: "+1 Episode",
                detail: `${episodeCount}${totalEpisodes != null ? ` of ${totalEpisodes}` : " watched"}`,
              }
            : liveService
              ? null
              : { kind: "complete", label: "Mark Completed" }
          : rating == null
            ? { kind: "rate", label: "Rate It" }
            : { kind: "recommend", label: "Recommend to a Friend" };

  function runPrimary(kind: PrimaryKind) {
    if (kind === "start") chooseStatus("in_progress");
    else if (kind === "episode") stepEpisodes(1);
    else if (kind === "complete") chooseStatus("completed");
    else if (kind === "rate") scrollToRating();
    else setShareOpen(true);
  }

  const statusText = (s: ItemStatus) =>
    liveService && s === "in_progress" ? "Live Service" : statusLabel(s, section);

  return (
    <>
      <Modal open={Boolean(item)} onClose={requestClose} wide sheet>
        {current && (
          <fieldset disabled={saving} className="min-w-0">
            {/* Hero: the poster over a blurred wash of itself. Dragging it
                (on phones) pulls the sheet down. */}
            <div className="relative overflow-hidden sm:rounded-t-2xl">
              {current.cover_url && (
                <Image
                  src={current.cover_url}
                  alt=""
                  aria-hidden
                  fill
                  sizes="100vw"
                  className="scale-125 object-cover opacity-70 blur-2xl saturate-150"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-surface/5 via-surface/45 to-surface" />
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/45">
                  <XIcon className="h-4 w-4" />
                </span>
              </button>
              <SheetDragArea className="relative flex flex-col items-center px-5 pb-5 pt-9 text-center sm:flex-row sm:items-end sm:gap-6 sm:px-6 sm:pt-7 sm:text-left">
                <motion.div
                  layoutId={`cover-${current.id}`}
                  className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-lg bg-ivory shadow-[0_14px_36px_rgba(0,0,0,0.35)] sm:w-36"
                >
                  {current.cover_url ? (
                    <Image
                      src={current.cover_url}
                      alt=""
                      fill
                      draggable={false}
                      sizes="144px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-4xl text-line-strong">
                      {current.title.charAt(0)}
                    </div>
                  )}
                </motion.div>
                <div className="mt-4 min-w-0 sm:mt-0 sm:pb-1">
                  <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-ink text-balance">
                    {current.title}
                  </h2>
                  <p className="mt-1 text-footnote text-muted">
                    {[
                      section.label === "Series" ? "Series" : section.singular.replace(/^./, (c) => c.toUpperCase()),
                      current.release_year,
                      current.genres.slice(0, 3).join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </SheetDragArea>
            </div>

            <div className="px-4 pb-5 sm:px-6 sm:pb-6">
              {discardRequested && (
                <div
                  ref={bannerRef}
                  role="alert"
                  className="mb-4 rounded-xl bg-ivory p-4"
                >
                  <p className="text-subhead font-semibold text-ink">
                    Discard your unsaved changes?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscardRequested(false)}
                      className="min-h-11 flex-1 rounded-xl bg-surface px-4 text-subhead font-medium text-ink"
                    >
                      Keep Editing
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-11 flex-1 rounded-xl bg-surface px-4 text-subhead font-medium text-danger"
                    >
                      Discard Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Primary action, favourite, and everything else under ⋯ */}
              <div className="flex items-stretch gap-2">
                {primary ? (
                  <button
                    type="button"
                    onClick={() => runPrimary(primary.kind)}
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-subhead font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    {primary.label}
                    {primary.detail && (
                      <span className="font-normal text-white/80 tabular-nums">
                        · {primary.detail}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-ivory text-subhead font-medium text-muted">
                    {statusText(status)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void quick({ is_favorite: !isFavorite })}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? "Remove from favourites" : "Favourite"}
                  className="flex min-h-12 w-12 items-center justify-center rounded-xl bg-ivory text-accent transition-colors hover:bg-line"
                >
                  <HeartIcon
                    className="h-5 w-5"
                    fill={isFavorite ? "currentColor" : "none"}
                  />
                </button>
                <button
                  type="button"
                  aria-label="More actions"
                  aria-haspopup="menu"
                  onClick={(e) => moreMenu.openFrom(e.currentTarget, "right")}
                  className="flex min-h-12 w-12 items-center justify-center rounded-xl bg-ivory text-accent transition-colors hover:bg-line"
                >
                  <EllipsisCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {(chips.length > 0 || releaseBadge(current) || isPrivate || pinned) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(() => {
                    const badge = releaseBadge(current);
                    return badge ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          badge.label === "Out now"
                            ? "bg-sage-soft text-sage"
                            : "bg-accent-soft text-accent-hover"
                        }`}
                      >
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                  {pinned && (
                    <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-hover">
                      <PinIcon className="h-3 w-3" />
                      Up Next
                    </span>
                  )}
                  {isPrivate && (
                    <span className="flex items-center gap-1 rounded-full bg-ivory px-2.5 py-1 text-xs font-medium text-body">
                      <EyeOffIcon className="h-3 w-3" />
                      Hidden from friends
                    </span>
                  )}
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-ivory px-2.5 py-1 text-xs text-body"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              <PopoverMenu
                anchor={moreMenu.anchor}
                onClose={moreMenu.close}
                label="More actions"
                sections={[
                  [
                    {
                      label: pinned ? "Unpin from Up Next" : "Pin to Up Next",
                      icon: <PinIcon className="h-[18px] w-[18px]" />,
                      onSelect: () =>
                        void quick({
                          pinned_at: pinned
                            ? null
                            : (current.pinned_at ?? new Date().toISOString()),
                        }),
                    },
                    {
                      label: "Recommend to a Friend",
                      icon: <SendIcon className="h-[18px] w-[18px]" />,
                      onSelect: () => setShareOpen(true),
                    },
                  ],
                  [
                    ...(section.mediaType === "game"
                      ? [
                          {
                            label: "Live Service Game",
                            checked: liveService,
                            icon: <InfinityIcon className="h-[18px] w-[18px]" />,
                            onSelect: () => void quick({ live_service: !liveService }),
                          },
                        ]
                      : []),
                    {
                      label: "Hide from Friends",
                      checked: isPrivate,
                      icon: <EyeOffIcon className="h-[18px] w-[18px]" />,
                      onSelect: () => void quick({ is_private: !isPrivate }),
                    },
                  ],
                  [
                    {
                      label: "Remove from Library",
                      icon: <TrashIcon className="h-[18px] w-[18px]" />,
                      destructive: true,
                      onSelect: handleRemove,
                    },
                  ],
                ]}
              />

              {/* Tracking — Settings-style rows */}
              <GroupLabel>Tracking</GroupLabel>
              <Group>
                <Row label="Status">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    onClick={(e) => statusMenu.openFrom(e.currentTarget, "right")}
                    className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-accent transition-colors hover:bg-line/60"
                  >
                    {statusText(status)}
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m8 10 4-4 4 4M8 14l4 4 4-4" />
                    </svg>
                  </button>
                </Row>
                {status !== "backlog" && (
                  <Row label={section.startedLabel}>
                    <input
                      type="date"
                      value={startedAt}
                      max={todayISODate()}
                      onChange={(e) => setStartedAt(e.target.value)}
                      aria-label={section.startedLabel}
                      className="min-h-9 rounded-lg bg-surface px-2 text-right text-subhead text-ink"
                    />
                  </Row>
                )}
                {status !== "backlog" && isEpisodic && (
                  <Row label="Episodes">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={totalEpisodes ?? undefined}
                      step={1}
                      value={episodes}
                      onChange={(e) => setEpisodes(e.target.value)}
                      aria-label="Episodes watched"
                      placeholder="0"
                      className="min-h-9 w-14 rounded-lg bg-surface text-center text-subhead tabular-nums text-ink"
                    />
                    {totalEpisodes != null && (
                      <span className="mr-2 tabular-nums">of {totalEpisodes}</span>
                    )}
                    <span className="flex overflow-hidden rounded-lg bg-surface">
                      <button
                        type="button"
                        onClick={() => stepEpisodes(-1)}
                        aria-label="One fewer episode watched"
                        className="relative flex h-9 w-11 items-center justify-center text-lg text-ink transition-colors hover:bg-line/60"
                      >
                        −
                      </button>
                      <span className="my-2 w-px bg-line" />
                      <button
                        type="button"
                        onClick={() => stepEpisodes(1)}
                        aria-label="One more episode watched"
                        className="relative flex h-9 w-11 items-center justify-center text-lg text-ink transition-colors hover:bg-line/60"
                      >
                        +
                      </button>
                    </span>
                  </Row>
                )}
                {status !== "backlog" && section.mediaType === "game" && (
                  <Row label="Hours Played">
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="0"
                      aria-label="Hours played"
                      className="min-h-9 w-20 rounded-lg bg-surface px-2 text-right text-subhead tabular-nums text-ink"
                    />
                    <span>h</span>
                  </Row>
                )}
                {status === "completed" && (
                  <div ref={ratingRef}>
                    <Row label="Rating">
                      <StarRating
                        value={rating}
                        onChange={(v) => void quick({ rating: v })}
                        size={22}
                      />
                    </Row>
                  </div>
                )}
              </Group>

              <PopoverMenu
                anchor={statusMenu.anchor}
                onClose={statusMenu.close}
                label="Status"
                sections={[
                  STATUS_ORDER.map((s) => ({
                    label: statusLabel(s, section),
                    checked: status === s,
                    onSelect: () => chooseStatus(s),
                  })),
                ]}
              />

              {section.mediaType === "game" && status === "in_progress" && (
                <>
                  <GroupLabel>Current Thoughts</GroupLabel>
                  <Group>
                    <textarea
                      value={currentThoughts}
                      onChange={(e) => setCurrentThoughts(e.target.value)}
                      rows={3}
                      placeholder={
                        liveService
                          ? "This one doesn't really end — what's your take right now?"
                          : "Not finished yet, but what's the verdict so far?"
                      }
                      aria-label="Current thoughts"
                      className={textareaCls}
                    />
                  </Group>
                  <p className="mt-1.5 px-4 text-footnote text-muted">
                    Friends can see this, like a review, unless you hide this title.
                  </p>
                </>
              )}

              {status === "completed" && (
                <>
                  <GroupLabel>Your Review</GroupLabel>
                  <Group>
                    <textarea
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      rows={4}
                      placeholder="What did you think?"
                      aria-label="Your review"
                      className={textareaCls}
                    />
                  </Group>
                </>
              )}

              <GroupLabel icon={<EyeOffIcon className="h-3 w-3" />}>
                Private Notes
              </GroupLabel>
              <Group>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Only you can see this."
                  aria-label="Private notes"
                  className={textareaCls}
                />
              </Group>

              {/* Friends who also have this title */}
              {alsoHave.length > 0 && (
                <>
                  <GroupLabel>
                    {alsoHave.length === 1
                      ? "A friend also has this"
                      : "Friends also have this"}
                  </GroupLabel>
                  <Group>
                    {alsoHave.map(({ profile, item: it }) => (
                      <Link
                        key={profile.id}
                        href={`/friends/${profile.username}`}
                        onClick={(event) => {
                          if (dirty || saving) event.preventDefault();
                          requestClose();
                        }}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-line/40"
                      >
                        <Avatar profile={profile} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                            <span className="font-medium text-ink">
                              {profile.display_name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[it.status]}`}
                              />
                              {statusLabelFor(it.status, it.media_type)}
                            </span>
                            {it.rating != null && (
                              <StarRating value={it.rating} size={12} />
                            )}
                          </div>
                          {it.review ? (
                            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-body">
                              {it.review}
                            </p>
                          ) : (
                            it.current_thoughts && (
                              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm italic leading-relaxed text-body">
                                {it.current_thoughts}
                              </p>
                            )
                          )}
                        </div>
                        <ChevronRightIcon className="mt-2 h-4 w-4 shrink-0 text-muted" />
                      </Link>
                    ))}
                  </Group>
                </>
              )}

              {hasShareableTake(current) && myId && (
                <div className="mt-6">
                  <CommentThread
                    itemId={current.id}
                    ownerId={myId}
                    onClose={onClose}
                  />
                </div>
              )}

              {saveError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent-hover"
                >
                  {saveError}
                </p>
              )}
            </div>

            {/* Only typed edits wait for Save — the bar appears when there are some. */}
            <AnimatePresence initial={false}>
              {dirty && (
                <motion.div
                  key="save-bar"
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 16, opacity: 0 }}
                  transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                  className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-line bg-surface/90 px-4 py-3 backdrop-blur-xl sm:rounded-b-2xl sm:px-6"
                >
                  <span aria-live="polite" className="flex-1 text-footnote text-muted">
                    {saving ? "Saving…" : "Unsaved changes"}
                  </span>
                  <button
                    type="button"
                    onClick={revert}
                    className="min-h-11 rounded-xl px-4 text-subhead font-medium text-accent transition-colors hover:bg-ivory"
                  >
                    Revert
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="min-h-11 rounded-xl bg-accent px-5 text-subhead font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </fieldset>
        )}
      </Modal>
      <ShareToFriendModal
        item={shareOpen ? current : null}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
