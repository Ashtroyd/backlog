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
import { supabase } from "@/lib/supabase";
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

  const load = useCallback(() => {
    if (!myId) return;
    fetchThread(myId, friend.id).then((msgs) => {
      setMessages(msgs);
      setReady(true);
      markThreadRead(myId, friend.id);
    });
  }, [myId, friend.id]);

  // Load once, then listen for the friend's messages in realtime (needs the
  // 0007 realtime migration); a slow poll covers setups without it.
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    if (!myId) return () => clearInterval(t);
    const channel = supabase
      .channel(`thread-${friend.id}-${myId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${myId}`,
        },
        (payload) => {
          if ((payload.new as Message).sender_id === friend.id) load();
        },
      )
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [load, myId, friend.id]);

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
    // Header is two rows on mobile, one on desktop — hence the different offsets.
    <div className="flex h-[calc(100dvh-11rem)] flex-col pt-4 sm:h-[calc(100dvh-10rem)] sm:pt-6">
      <header className="flex items-center gap-3 border-b border-line pb-4">
        <Link
          href="/messages"
          aria-label="Back to messages"
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
                    className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-subhead leading-relaxed ${
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
                <span className="px-1 text-caption2 text-muted">
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
          aria-label={`Message ${friend.display_name}`}
          placeholder={`Message ${friend.display_name}…`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-32 min-h-[44px] w-full resize-none rounded-[10px] border border-transparent bg-ivory px-3.5 py-2.5 text-subhead leading-relaxed text-ink placeholder:text-muted transition-colors focus:border-accent/40"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={sending || !text.trim()}
          aria-label="Send message"
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
