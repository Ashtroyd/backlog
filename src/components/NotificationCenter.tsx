"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/backlog-store";
import {
  acceptRequest,
  activityVerb,
  fetchActivity,
  fetchConnections,
  removeFriendship,
  type ActivityEntry,
  type Connection,
} from "@/lib/social";
import { statusLabelFor } from "@/lib/sections";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";
import { StarRating } from "./StarRating";
import { BellIcon, CheckIcon, XIcon } from "./icons";

const SEEN_KEY = "backlog:activitySeen";

type Tab = "requests" | "activity";

export function NotificationCenter() {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("requests");
  const [incoming, setIncoming] = useState<Connection[]>([]);
  const [friends, setFriends] = useState<Connection[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!myId) return;
    const conns = await fetchConnections(myId);
    setIncoming(conns.incoming);
    setFriends(conns.friends);
    const feed = await fetchActivity(conns.friends);
    setActivity(feed);
  }, [myId]);

  useEffect(() => {
    try {
      setLastSeen(Number(localStorage.getItem(SEEN_KEY) ?? 0));
    } catch {
      // ignore
    }
    load();
  }, [load]);

  // Fresh data each time the panel opens.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const newActivity = activity.filter(
    (a) => new Date(a.item.updated_at).getTime() > lastSeen,
  ).length;
  const badge = incoming.length + newActivity;

  function openTab(next: Tab) {
    setTab(next);
    if (next === "activity") {
      const now = Date.now();
      try {
        localStorage.setItem(SEEN_KEY, String(now));
      } catch {
        // ignore
      }
      setLastSeen(now);
    }
  }

  function openPanel() {
    setOpen((v) => {
      const next = !v;
      if (next) setTab(incoming.length ? "requests" : "activity");
      return next;
    });
  }

  async function handleAccept(c: Connection) {
    setBusyId(c.friendshipId);
    await acceptRequest(c.friendshipId);
    setBusyId(null);
    load();
  }

  async function handleDecline(c: Connection) {
    setBusyId(c.friendshipId);
    await removeFriendship(c.friendshipId);
    setBusyId(null);
    load();
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Notifications"
        onClick={openPanel}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-ivory hover:text-ink ${
          open ? "bg-ivory text-ink" : "text-muted"
        }`}
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_32px_rgba(38,37,33,0.16)]"
            >
              <div className="flex gap-1 border-b border-line p-1.5">
                <TabButton
                  active={tab === "requests"}
                  onClick={() => openTab("requests")}
                  label="Requests"
                  count={incoming.length}
                />
                <TabButton
                  active={tab === "activity"}
                  onClick={() => openTab("activity")}
                  label="Activity"
                  count={newActivity}
                />
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {tab === "requests" ? (
                  incoming.length === 0 ? (
                    <Empty text="No friend requests right now." />
                  ) : (
                    <ul className="space-y-1">
                      {incoming.map((c) => (
                        <li
                          key={c.friendshipId}
                          className="flex items-center gap-2.5 rounded-xl px-2 py-2"
                        >
                          <Link
                            href={`/friends/${c.profile.username}`}
                            onClick={() => setOpen(false)}
                            className="flex min-w-0 flex-1 items-center gap-2.5"
                          >
                            <Avatar profile={c.profile} size={36} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">
                                {c.profile.display_name}
                              </p>
                              <p className="truncate text-xs text-muted">
                                wants to be friends
                              </p>
                            </div>
                          </Link>
                          <button
                            type="button"
                            title="Accept"
                            disabled={busyId === c.friendshipId}
                            onClick={() => handleAccept(c)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Decline"
                            disabled={busyId === c.friendshipId}
                            onClick={() => handleDecline(c)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink disabled:opacity-60"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : activity.length === 0 ? (
                  <Empty
                    text={
                      friends.length
                        ? "No friend activity yet."
                        : "Add friends to see their activity here."
                    }
                  />
                ) : (
                  <ul className="space-y-0.5">
                    {activity.map((a) => {
                      const { verb, showStars } = activityVerb(a.item);
                      return (
                        <li key={a.item.id}>
                          <Link
                            href={`/friends/${a.profile.username}`}
                            onClick={() => setOpen(false)}
                            className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-ivory"
                          >
                            <Avatar profile={a.profile} size={32} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug text-body">
                                <span className="font-medium text-ink">
                                  {a.profile.display_name}
                                </span>{" "}
                                {verb}{" "}
                                <span className="font-medium text-ink">
                                  {a.item.title}
                                </span>
                              </p>
                              <div className="mt-0.5 flex items-center gap-2">
                                {showStars && a.item.rating != null && (
                                  <StarRating value={a.item.rating} size={11} />
                                )}
                                <span className="text-xs text-muted">
                                  {statusLabelFor(a.item.status, a.item.media_type)}{" "}
                                  · {timeAgo(a.item.updated_at)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-ivory text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {count > 0 && (
        <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="px-4 py-8 text-center text-sm leading-relaxed text-muted">
      {text}
    </p>
  );
}
