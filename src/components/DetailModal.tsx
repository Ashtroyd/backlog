"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { STATUS_DOT } from "./ItemCard";
import { EyeOffIcon, HeartIcon, SendIcon, TrashIcon, XIcon } from "./icons";

export function DetailModal({
  item,
  section,
  onClose,
  onUpdate,
  onRemove,
}: {
  item: BacklogItem | null;
  section: Section;
  onClose: () => void;
  onUpdate: (id: string, patch: UpdatePatch) => void;
  onRemove: (id: string) => void;
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

  function handleSave() {
    if (!current) return;
    onUpdate(current.id, {
      status,
      rating,
      review,
      is_private: isPrivate,
      is_favorite: isFavorite,
      started_at: startedAt || null,
    });
    onClose();
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

              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
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
                          className="w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Friends who also have this title */}
              {alsoHave.length > 0 && (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
                    {alsoHave.length === 1 ? "A friend also has this" : "Friends also have this"}
                  </p>
                  <ul className="space-y-3">
                    {alsoHave.map(({ profile, item: it }) => (
                      <li key={profile.id} className="flex items-start gap-2.5">
                        <Link href={`/friends/${profile.username}`} onClick={onClose}>
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
