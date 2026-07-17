"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/backlog-store";
import {
  addComment,
  deleteComment,
  fetchComments,
  type Comment,
} from "@/lib/social";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";
import { SpinnerIcon, TrashIcon } from "./icons";

/**
 * Shared comment thread under a review. Any mutual friend who can see the
 * review can read and post; authors (and the review's owner) can delete.
 */
export function CommentThread({
  itemId,
  ownerId,
  onClose,
}: {
  itemId: string;
  ownerId: string;
  onClose?: () => void;
}) {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;

  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchComments(itemId)
      .then((c) => alive && setComments(c))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [itemId]);

  async function post() {
    if (!myId || !body.trim()) return;
    setPosting(true);
    const { comment } = await addComment(itemId, myId, body);
    setPosting(false);
    if (comment) {
      setComments((prev) => [...(prev ?? []), comment]);
      setBody("");
    }
  }

  async function remove(id: string) {
    setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
    await deleteComment(id);
  }

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        {comments && comments.length > 0
          ? `${comments.length} comment${comments.length === 1 ? "" : "s"}`
          : "Comments"}
      </p>

      {comments === null ? (
        <div className="flex justify-center py-4">
          <SpinnerIcon className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : comments.length === 0 ? (
        <p className="pb-3 text-sm text-muted">
          No comments yet — start the conversation.
        </p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {comments.map((c) => {
              const canDelete = c.author.id === myId || myId === ownerId;
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2.5"
                >
                  {/* Hidden from assistive tech — the name link right after
                      repeats the same destination with a real accessible name. */}
                  <Link
                    href={`/friends/${c.author.username}`}
                    onClick={onClose}
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <Avatar profile={c.author} size={30} />
                  </Link>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-ivory px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <Link
                          href={`/friends/${c.author.username}`}
                          onClick={onClose}
                          className="text-sm font-medium text-ink hover:text-accent"
                        >
                          {c.author.display_name}
                        </Link>
                        <span className="text-xs text-muted">
                          {timeAgo(c.created_at)}
                        </span>
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => remove(c.id)}
                          title="Delete comment"
                          className="-mr-1 shrink-0 rounded-full p-1 text-muted transition-colors hover:text-accent-hover"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-body">
                      {c.body}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
          }}
          className="max-h-32 min-h-[42px] w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
        />
        <button
          type="button"
          onClick={post}
          disabled={posting || !body.trim()}
          className="flex h-[42px] shrink-0 items-center rounded-xl bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {posting ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : "Post"}
        </button>
      </div>
    </div>
  );
}
