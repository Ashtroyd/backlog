"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { fetchConnections } from "@/lib/social";
import { fetchConversations, type Conversation } from "@/lib/messages";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { SpinnerIcon } from "@/components/icons";
import { FriendsTabs } from "../FriendsTabs";

function preview(c: Conversation, myId: string): string {
  const m = c.lastMessage;
  if (!m) return "Say hello 👋";
  const mine = m.sender_id === myId ? "You: " : "";
  if (m.shared_item) return `${mine}Recommended ${m.shared_item.title}`;
  return `${mine}${m.body ?? ""}`;
}

export default function MessagesList() {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;
  const [convos, setConvos] = useState<Conversation[] | null>(null);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchConnections(myId)
      .then((conns) => fetchConversations(myId, conns.friends))
      .then((c) => alive && setConvos(c));
    return () => {
      alive = false;
    };
  }, [myId]);

  return (
    <div>
      <FriendsTabs active="messages" />
      <h2 className="sr-only">Messages</h2>

      {convos === null ? (
        <div className="flex justify-center pt-16">
          <SpinnerIcon className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : convos.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted">
          Add some friends first — you can message anyone you&apos;re friends with.{" "}
          <Link href="/friends" className="font-medium text-accent hover:text-accent-hover">
            Find friends
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {convos.map((c) => (
            <li key={c.friend.id}>
              <Link
                href={`/messages/${c.friend.username}`}
                className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-ivory"
              >
                <Avatar profile={c.friend} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-ink">
                      {c.friend.display_name}
                    </p>
                    {c.lastMessage && (
                      <span className="shrink-0 text-xs text-muted">
                        {timeAgo(c.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-sm ${
                        c.unread > 0 ? "font-medium text-ink" : "text-muted"
                      }`}
                    >
                      {preview(c, myId!)}
                    </p>
                    {c.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-caption2 font-semibold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
