"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STATUS_ORDER, statusLabel, statusLabelFor, type Section } from "@/lib/sections";
import { useAuth, type UpdatePatch } from "@/lib/backlog-store";
import { fetchAlsoHave, type AlsoHave } from "@/lib/social";
import { itemChips } from "@/lib/chips";
import { todayISODate } from "@/lib/format";
import type { BacklogItem, ItemStatus } from "@/lib/types";
import { Modal } from "./Modal";
import { StarRating } from "./StarRating";
import { Avatar } from "./Avatar";
import { CommentThread } from "./CommentThread";
import { useConfirm } from "./ConfirmDialog";
import { ShareToFriendModal } from "./ShareToFriendModal";
import { releaseBadge, STATUS_DOT } from "./ItemCard";
import { EyeOffIcon, HeartIcon, InfinityIcon, PinIcon, SendIcon, TrashIcon, XIcon } from "./icons";

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
  onUpdate: (id: string, patch: UpdatePatch) => void;
  onRemove: (id: string) => void;
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
  const [alsoHave, setAlsoHave] = useState<AlsoHave[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (item) {
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
    }
  }, [item]);

  // Moving out of the backlog for the first time defaults the start date to
  // today (still editable). We never overwrite a date that's already set.
  function chooseStatus(next: ItemStatus) {
    setStatus(next);
    if ((next === "in_progress" || next === "completed") && !startedAt) {
      setStartedAt(todayISODate());
    }
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
  const totalEpisodes = current?.meta?.episodes ?? null;

  function handleSave() {
    if (!current) return;
    const parsedEpisodes =
      episodes.trim() === "" ? null : Math.max(0, Math.floor(Number(episodes)));
    const parsedHours =
      hours.trim() === "" ? null : Math.max(0, Number(hours));
    onUpdate(current.id, {
      status,
      rating,
      review,
      notes,
      is_private: isPrivate,
      is_favorite: isFavorite,
      started_at: startedAt || null,
      progress: isEpisodic && !Number.isNaN(parsedEpisodes ?? 0) ? parsedEpisodes : undefined,
      hours_played:
        section.mediaType === "game" && !Number.isNaN(parsedHours ?? 0)
          ? parsedHours
          : undefined,
      live_service: section.mediaType === "game" ? liveService : undefined,
      // Preserve the original pin time so re-saving doesn't bump it to the
      // front of "Up next" — only a fresh pin gets a new timestamp.
      pinned_at: pinned ? (current.pinned_at ?? new Date().toISOString()) : null,
    });
    onClose();
  }

  /** Step the episode counter, clamped to [0, total] when the total is known. */
  function stepEpisodes(delta: number) {
    setEpisodes((prev) => {
      const next = Math.max(0, (Number(prev) || 0) + delta);
      return String(totalEpisodes != null ? Math.min(next, totalEpisodes) : next);
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
    onRemove(current.id);
    onClose();
  }

  const chips = itemChips(current);

  return (
    <>
    <Modal open={Boolean(item)} onClose={onClose} wide>
      {current && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-6">
            <div className="relative hidden aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border border-line bg-ivory sm:block">
              {current.cover_url && (
                <Image
                  src={current.cover_url}
                  alt=""
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-2xl font-semibold leading-snug tracking-tight text-ink">
                  {current.title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                {[current.release_year, current.genres.join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {(chips.length > 0 || releaseBadge(current)) && (
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

              <div className="mt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Status
                </p>
                {/* Pills wrap on narrow screens, so soften the corners rather
                    than keeping a full pill shape around two rows. */}
                <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-ivory p-1 sm:rounded-full">
                  {STATUS_ORDER.map((s) => {
                    const active = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => chooseStatus(s)}
                        className={`relative rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                          active ? "text-ink" : "text-muted hover:text-ink"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId={`status-thumb-${current.id}`}
                            className="absolute inset-0 rounded-full bg-surface shadow-sm"
                            transition={{
                              type: "spring",
                              duration: 0.4,
                              bounce: 0.15,
                            }}
                          />
                        )}
                        <span className="relative">{statusLabel(s, section)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {status !== "backlog" && (
                  <motion.div
                    key="started"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 pt-1">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                        {section.startedLabel}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={startedAt}
                          max={todayISODate()}
                          onChange={(e) => setStartedAt(e.target.value)}
                          aria-label={section.startedLabel}
                          className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink transition-colors focus:border-line-strong"
                        />
                        {startedAt && (
                          <button
                            type="button"
                            onClick={() => setStartedAt("")}
                            className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-ivory hover:text-ink"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {status !== "backlog" && (isEpisodic || section.mediaType === "game") && (
                  <motion.div
                    key="progress"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 pt-1">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                        {isEpisodic ? "Episodes watched" : "Hours played"}
                      </p>
                      {isEpisodic ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => stepEpisodes(-1)}
                            aria-label="Decrease episodes watched"
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-ivory"
                          >
                            −
                          </button>
                          <span className="min-w-[6rem] text-center text-[15px] tabular-nums text-ink">
                            {episodes || "0"}
                            {totalEpisodes != null ? ` of ${totalEpisodes}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => stepEpisodes(1)}
                            aria-label="Increase episodes watched"
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-ivory"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          placeholder="0"
                          aria-label="Hours played"
                          className="w-32 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink transition-colors focus:border-line-strong"
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {status === "completed" && (
                  <motion.div
                    key="review"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 space-y-4 pt-1">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                          Your rating
                        </p>
                        <StarRating value={rating} onChange={setRating} size={26} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                          Your review
                        </p>
                        <textarea
                          value={review}
                          onChange={(e) => setReview(e.target.value)}
                          rows={4}
                          placeholder="What did you think?"
                          aria-label="Your review"
                          className="w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  <EyeOffIcon className="h-3 w-3" />
                  Private notes
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Only you can see this — jot down anything worth remembering."
                  aria-label="Private notes"
                  className="w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
                />
              </div>

              {/* Friends who also have this title */}
              {alsoHave.length > 0 && (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
                    {alsoHave.length === 1 ? "A friend also has this" : "Friends also have this"}
                  </p>
                  <ul className="space-y-3">
                    {alsoHave.map(({ profile, item: it }) => (
                      <li key={profile.id} className="flex items-start gap-2.5">
                        {/* The name link right after this repeats the same
                            destination with a real accessible name, so this
                            one is hidden from assistive tech to avoid a
                            duplicate stop. */}
                        <Link
                          href={`/friends/${profile.username}`}
                          onClick={onClose}
                          aria-hidden="true"
                          tabIndex={-1}
                        >
                          <Avatar profile={profile} size={34} />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                            <Link
                              href={`/friends/${profile.username}`}
                              onClick={onClose}
                              className="font-medium text-ink hover:text-accent"
                            >
                              {profile.display_name}
                            </Link>
                            <span className="inline-flex items-center gap-1 text-xs text-muted">
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[it.status]}`} />
                              {statusLabelFor(it.status, it.media_type)}
                            </span>
                            {it.rating != null && <StarRating value={it.rating} size={12} />}
                          </div>
                          {it.review && (
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-body">
                              {it.review}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {current.status === "completed" && myId && (
                <div className="mt-6 border-t border-line pt-4">
                  <CommentThread itemId={current.id} ownerId={myId} onClose={onClose} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent-hover"
              >
                <TrashIcon className="h-4 w-4" />
                Remove
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                title="Recommend to a friend"
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-ivory hover:text-ink"
              >
                <SendIcon className="h-4 w-4" />
                Recommend
              </button>
              <button
                type="button"
                onClick={() => setIsFavorite((v) => !v)}
                title={
                  isFavorite
                    ? `Your favourite ${section.singular} — click to unset`
                    : `Set as your favourite ${section.singular}`
                }
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  isFavorite
                    ? "bg-accent-soft text-accent-hover"
                    : "text-muted hover:bg-ivory hover:text-ink"
                }`}
              >
                <HeartIcon
                  className="h-4 w-4"
                  fill={isFavorite ? "currentColor" : "none"}
                />
                {isFavorite ? "Favourite" : "Favourite"}
              </button>
              <button
                type="button"
                onClick={() => setPinned((v) => !v)}
                title={
                  pinned
                    ? "Pinned to Up next — click to unpin"
                    : "Pin to Up next"
                }
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  pinned
                    ? "bg-accent-soft text-accent-hover"
                    : "text-muted hover:bg-ivory hover:text-ink"
                }`}
              >
                <PinIcon className="h-4 w-4" fill={pinned ? "currentColor" : "none"} />
                {pinned ? "Pinned" : "Pin"}
              </button>
              {section.mediaType === "game" && (
                <button
                  type="button"
                  onClick={() => setLiveService((v) => !v)}
                  title={
                    liveService
                      ? "Tagged as live service — click to unset"
                      : "Tag as a live-service game with no real \"completed\" state"
                  }
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    liveService
                      ? "bg-accent-soft text-accent-hover"
                      : "text-muted hover:bg-ivory hover:text-ink"
                  }`}
                >
                  <InfinityIcon className="h-4 w-4" />
                  Live Service
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                title={
                  isPrivate
                    ? "Hidden from friends — click to make visible"
                    : "Visible to friends — click to hide"
                }
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  isPrivate
                    ? "bg-ivory text-ink"
                    : "text-muted hover:bg-ivory hover:text-ink"
                }`}
              >
                <EyeOffIcon className="h-4 w-4" />
                {isPrivate ? "Private" : "Hide"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </Modal>
    <ShareToFriendModal
      item={shareOpen ? current : null}
      onClose={() => setShareOpen(false)}
    />
    </>
  );
}
