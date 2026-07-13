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
  fetchNotifications,
  markNotificationsRead,
  removeFriendship,
  type ActivityEntry,
  type Connection,
  type Notification,
} from "@/lib/social";
import { statusLabelFor } from "@/lib/sections";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";
import { StarRating } from "./StarRating";
import { ReviewCommentsModal } from "./ReviewCommentsModal";
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!myId) return;
    const [conns, notifs] = await Promise.all([
      fetchConnections(myId),
      fetchNotifications(myId),
    ]);
    setIncoming(conns.incoming);
    setFriends(conns.friends);
    setNotifications(notifs);
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
    if (!myId) return undefined;
    // New notifications arrive live once the 0007 realtime migration is run.
    const channel = supabase
      .channel(`notifs-${myId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${myId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, myId]);

  // Fresh data each time the panel opens.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const newActivity = activity.filter(
    (a) => new Date(a.item.updated_at).getTime() > lastSeen,
  ).length;
  const unreadNotifs = notifications.filter((n) => !n.read_at).length;
  const badge = incoming.length + unreadNotifs;

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
      const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);
      if (unread.length) {
        markNotificationsRead(unread);
        setNotifications((prev) =>
          prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
        );
      }
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

      {/* Backdrop lives outside AnimatePresence — a Fragment child can't be
          tracked for exit and gets stranded over the page. */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
      <AnimatePresence>
        {open && (
            <motion.div
              key="notif-panel"
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
                  count={unreadNotifs + newActivity}
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
                ) : notifications.length === 0 && activity.length === 0 ? (
                  <Empty
                    text={
                      friends.length
                        ? "Nothing new yet."
                        : "Add friends to see their activity here."
                    }
                  />
                ) : (
                  <div className="space-y-0.5">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setOpenItemId(n.item?.id ?? null);
                          setOpen(false);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ivory"
                      >
                        <Avatar profile={n.actor} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-body">
                            <span className="font-medium text-ink">
                              {n.actor.display_name}
                            </span>{" "}
                            commented on your review of{" "}
                            <span className="font-medium text-ink">
                              {n.item?.title ?? "an item"}
                            </span>
                          </p>
                          <span className="text-xs text-muted">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        {!n.read_at && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </button>
                    ))}

                    {notifications.length > 0 && activity.length > 0 && (
                      <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
                        Friends&apos; activity
                      </p>
                    )}

                    {activity.map((a) => {
                      const { verb, showStars } = activityVerb(a.item);
                      return (
                        <Link
                          key={a.item.id}
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
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      <ReviewCommentsModal
        itemId={openItemId}
        onClose={() => {
          setOpenItemId(null);
          load();
        }}
      />
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
