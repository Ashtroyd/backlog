"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STATUS_ORDER, statusLabel, type Section } from "@/lib/sections";
import type { UpdatePatch } from "@/lib/backlog-store";
import type { BacklogItem, ItemStatus } from "@/lib/types";
import { Modal } from "./Modal";
import { StarRating } from "./StarRating";
import { TrashIcon, XIcon } from "./icons";

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
  // Keep the last item around so the close animation still has content.
  const [snapshot, setSnapshot] = useState<BacklogItem | null>(item);
  const [status, setStatus] = useState<ItemStatus>("backlog");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");

  useEffect(() => {
    if (item) {
      setSnapshot(item);
      setStatus(item.status);
      setRating(item.rating);
      setReview(item.review ?? "");
    }
  }, [item]);

  const current = item ?? snapshot;

  function handleSave() {
    if (!current) return;
    onUpdate(current.id, { status, rating, review });
    onClose();
  }

  function handleRemove() {
    if (!current) return;
    if (!confirm(`Remove “${current.title}” from your library?`)) return;
    onRemove(current.id);
    onClose();
  }

  const chips = buildChips(current);

  return (
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
                <div className="inline-flex flex-wrap gap-1 rounded-full bg-ivory p-1">
                  {STATUS_ORDER.map((s) => {
                    const active = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
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
                        <span className="relative">
                          {statusLabel(s, section)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                        <StarRating
                          value={rating}
                          onChange={setRating}
                          size={26}
                        />
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
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
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
              onClick={handleSave}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function buildChips(item: BacklogItem | null): string[] {
  if (!item) return [];
  const m = item.meta ?? {};
  const chips: string[] = [];
  if (m.platforms?.length) chips.push(m.platforms.join(" · "));
  if (m.metacritic) chips.push(`Metacritic ${m.metacritic}`);
  if (m.stars) chips.push(m.stars);
  if (m.tvmazeRating) chips.push(`TVMaze ${m.tvmazeRating}`);
  if (m.network) chips.push(m.network);
  if (m.episodes) chips.push(`${m.episodes} episodes`);
  if (m.malScore) chips.push(`MAL ${m.malScore}`);
  if (m.studios?.length) chips.push(m.studios.join(", "));
  return chips;
}
