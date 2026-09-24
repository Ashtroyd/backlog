"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { fetchItemById } from "@/lib/social";
import { statusLabelFor } from "@/lib/sections";
import type { BacklogItem } from "@/lib/types";
import { Modal } from "./Modal";
import { StarRating } from "./StarRating";
import { CommentThread } from "./CommentThread";
import { STATUS_DOT } from "./ItemCard";
import { SpinnerIcon, XIcon } from "./icons";

/** Standalone pop-up for a review's comment thread (opened from a notification). */
export function ReviewCommentsModal({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;
  const [item, setItem] = useState<BacklogItem | null>(null);

  useEffect(() => {
    if (!itemId) return;
    setItem(null);
    fetchItemById(itemId)
      .then(setItem)
      .catch(() => setItem(null));
  }, [itemId]);

  return (
    <Modal open={Boolean(itemId)} onClose={onClose} wide>
      {item ? (
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="relative hidden aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-ivory sm:block">
              {item.cover_url && (
                <Image src={item.cover_url} alt="" fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-semibold leading-snug tracking-tight text-ink">
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
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[item.status]}`} />
                {statusLabelFor(item.status, item.media_type)}
              </p>
              {item.rating != null && (
                <div className="mt-2">
                  <StarRating value={item.rating} size={16} />
                </div>
              )}
              {item.review && (
                <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-paper p-3.5 text-subhead leading-relaxed text-body">
                  {item.review}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <CommentThread itemId={item.id} ownerId={myId ?? ""} onClose={onClose} />
          </div>
        </div>
      ) : (
        <div className="flex justify-center p-16">
          <SpinnerIcon className="h-6 w-6 animate-spin text-muted" />
        </div>
      )}
    </Modal>
  );
}
