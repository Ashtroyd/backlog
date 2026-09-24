"use client";

import Image from "next/image";
import Link from "next/link";
import { STATUS_DOT } from "@/components/ItemCard";
import { statusLabelFor, startedLabelFor } from "@/lib/sections";
import { hasShareableTake, itemChips } from "@/lib/chips";
import { formatDate } from "@/lib/format";
import type { BacklogItem, Profile } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { StarRating } from "@/components/StarRating";
import { Avatar } from "@/components/Avatar";
import { CommentThread } from "@/components/CommentThread";
import { XIcon } from "@/components/icons";

/** Read-only view of one of a friend's items: their status, rating, review. */
export function FriendItemModal({
  item,
  profile,
  mine,
  onClose,
}: {
  item: BacklogItem | null;
  profile: Profile;
  mine: BacklogItem | null;
  onClose: () => void;
}) {
  const chips = itemChips(item);

  return (
    <Modal open={Boolean(item)} onClose={onClose} wide sheet>
      {item && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-6">
            <div className="relative hidden aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border border-line bg-ivory sm:block">
              {item.cover_url && (
                <Image src={item.cover_url} alt="" fill sizes="144px" className="object-cover" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl font-bold leading-snug tracking-tight text-ink">
                  {item.title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                {[item.release_year, item.genres.join(", ")].filter(Boolean).join(" · ")}
              </p>

              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span key={c} className="rounded-full bg-ivory px-2.5 py-1 text-xs text-body">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar profile={profile} size={30} />
                  <p className="text-sm font-medium text-ink">
                    {profile.display_name}
                    <span className="font-normal text-muted">&apos;s take</span>
                  </p>
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-sm text-body">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[item.status]}`} />
                  {statusLabelFor(item.status, item.media_type)}
                </p>

                {item.started_at && (
                  <p className="mt-1.5 text-sm text-muted">
                    {startedLabelFor(item.media_type)} {formatDate(item.started_at)}
                  </p>
                )}

                {item.rating != null && (
                  <div className="mt-2">
                    <StarRating value={item.rating} size={18} />
                  </div>
                )}

                {item.review ? (
                  <p className="mt-3 whitespace-pre-wrap text-subhead leading-relaxed text-body">
                    {item.review}
                  </p>
                ) : item.current_thoughts ? (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">
                      Current thoughts
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-subhead leading-relaxed text-body">
                      {item.current_thoughts}
                    </p>
                  </>
                ) : (
                  item.status === "completed" && (
                    <p className="mt-3 text-sm italic text-muted">No review written.</p>
                  )
                )}
              </div>

              {mine && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[mine.status]}`} />
                  In your library — {statusLabelFor(mine.status, mine.media_type)}
                </p>
              )}
            </div>
          </div>

          {hasShareableTake(item) && (
            <div className="mt-6 border-t border-line pt-5">
              <CommentThread
                itemId={item.id}
                ownerId={profile.id}
                onClose={onClose}
              />
            </div>
          )}

          <div className="mt-6 border-t border-line pt-4 text-right">
            <Link
              href={`/friends/${profile.username}`}
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              View {profile.display_name}&apos;s backlog →
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
