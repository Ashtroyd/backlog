"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import {
  fetchThread,
  markThreadRead,
  sendMessage,
  type Message,
  type SharedItem,
} from "@/lib/messages";
import { timeAgo } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { ItemPicker } from "./ItemPicker";
import { SharedItemCard } from "./SharedItemCard";
import { HeartIcon, SendIcon, SpinnerIcon } from "@/components/icons";

export function MessageThread({ friend }: { friend: Profile }) {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!myId) return;
    const msgs = await fetchThread(myId, friend.id);
    setMessages(msgs);
    setReady(true);
    markThreadRead(myId, friend.id);
  }, [myId, friend.id]);

  // Load + light polling so replies show up without a refresh.
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(sharedItem?: SharedItem) {
    if (!myId) return;
    if (!text.trim() && !sharedItem) return;
    setSending(true);
    const { message } = await sendMessage(myId, friend.id, {
      body: text,
      sharedItem: sharedItem ?? null,
    });
    setSending(false);
    if (message) {
      setMessages((prev) => [...prev, message]);
      setText("");
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col pt-6">
      <header className="flex items-center gap-3 border-b border-line pb-4">
        <Link
          href="/messages"
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          ←
        </Link>
        <Link
          href={`/friends/${friend.username}`}
          className="flex min-w-0 items-center gap-2.5"
        >
          <Avatar profile={friend} size={38} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{friend.display_name}</p>
            <p className="truncate text-xs text-muted">@{friend.username}</p>
          </div>
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto py-5">
        {!ready ? (
          <div className="flex justify-center pt-8">
            <SpinnerIcon className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted">
            No messages yet. Say hi or share a recommendation.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}
              >
                {m.body && (
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                      mine
                        ? "rounded-br-sm bg-accent text-white"
                        : "rounded-bl-sm bg-ivory text-ink"
                    }`}
                  >
                    {m.body}
                  </div>
                )}
                {m.shared_item && (
                  <SharedItemCard item={m.shared_item} mine={mine} />
                )}
                <span className="px-1 text-[11px] text-muted">
                  {timeAgo(m.created_at)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title="Share a recommendation"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:bg-ivory hover:text-accent"
        >
          <HeartIcon className="h-5 w-5" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder={`Message ${friend.display_name}…`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-32 min-h-[44px] w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={sending || !text.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {sending ? (
            <SpinnerIcon className="h-4 w-4 animate-spin" />
          ) : (
            <SendIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <ItemPicker
        open={pickerOpen}
        myId={myId}
        onClose={() => setPickerOpen(false)}
        onPick={(item) => send(item)}
      />
    </div>
  );
}
