"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { fetchConnections, type Connection } from "@/lib/social";
import { sendMessage, sharedItemFrom } from "@/lib/messages";
import type { BacklogItem } from "@/lib/types";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { CheckIcon, SendIcon, SpinnerIcon } from "./icons";

/** Recommend an item to a friend as a direct message. */
export function ShareToFriendModal({
  item,
  onClose,
}: {
  item: BacklogItem | null;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;
  const [snapshot, setSnapshot] = useState<BacklogItem | null>(item);
  const [friends, setFriends] = useState<Connection[] | null>(null);
  const [note, setNote] = useState("");
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (item && myId) {
      setSnapshot(item);
      setNote("");
      setSentTo(new Set());
      setFriends(null);
      fetchConnections(myId)
        .then((c) => setFriends(c.friends))
        .catch(() => setFriends([]));
    }
  }, [item, myId]);

  const current = item ?? snapshot;

  async function share(f: Connection) {
    if (!current || !myId) return;
    setBusyId(f.profile.id);
    const { error } = await sendMessage(myId, f.profile.id, {
      body: note,
      sharedItem: sharedItemFrom(current),
    });
    setBusyId(null);
    if (!error) setSentTo((prev) => new Set(prev).add(f.profile.id));
  }

  return (
    <Modal open={Boolean(item)} onClose={onClose}>
      {current && (
        <div className="p-5">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Recommend <span className="text-accent">{current.title}</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted">Send it to a friend as a message.</p>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add a note (optional)…"
            aria-label="Add a note (optional)"
            className="mt-4 w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
          />

          <div className="mt-4 max-h-[45vh] overflow-y-auto">
            {friends === null ? (
              <div className="flex justify-center py-8">
                <SpinnerIcon className="h-5 w-5 animate-spin text-muted" />
              </div>
            ) : friends.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                Add some friends to recommend titles to them.
              </p>
            ) : (
              <ul className="space-y-1">
                {friends.map((f) => {
                  const sent = sentTo.has(f.profile.id);
                  return (
                    <li key={f.friendshipId} className="flex items-center gap-3 px-1 py-1.5">
                      <Avatar profile={f.profile} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {f.profile.display_name}
                        </p>
                        <p className="truncate text-xs text-muted">@{f.profile.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => share(f)}
                        disabled={sent || busyId === f.profile.id}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                          sent
                            ? "bg-sage-soft text-sage"
                            : "bg-accent text-white hover:bg-accent-hover"
                        }`}
                      >
                        {busyId === f.profile.id ? (
                          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : sent ? (
                          <>
                            <CheckIcon className="h-3.5 w-3.5" /> Sent
                          </>
                        ) : (
                          <>
                            <SendIcon className="h-3.5 w-3.5" /> Send
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
