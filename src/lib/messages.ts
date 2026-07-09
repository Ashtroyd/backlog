"use client";

import { supabase } from "./supabase";
import { fetchProfilesByIds, type Connection } from "./social";
import type { BacklogItem, MediaType, Profile } from "./types";

/** Self-contained snapshot of a recommended title, carried inside a message. */
export type SharedItem = {
  media_type: MediaType;
  external_id: string;
  title: string;
  cover_url: string | null;
  release_year: number | null;
  genres: string[];
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  shared_item: SharedItem | null;
  created_at: string;
  read_at: string | null;
};

export type Conversation = {
  friend: Profile;
  lastMessage: Message | null;
  unread: number;
};

export function sharedItemFrom(item: BacklogItem | SharedItem): SharedItem {
  return {
    media_type: item.media_type,
    external_id: item.external_id,
    title: item.title,
    cover_url: item.cover_url,
    release_year: item.release_year,
    genres: item.genres ?? [],
  };
}

/** All my messages, folded into one conversation per friend (most recent first). */
export async function fetchConversations(
  myId: string,
  friends: Connection[],
): Promise<Conversation[]> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
    .order("created_at", { ascending: false });
  const messages = (data as Message[]) ?? [];

  const lastByFriend = new Map<string, Message>();
  const unreadByFriend = new Map<string, number>();
  for (const m of messages) {
    const other = m.sender_id === myId ? m.recipient_id : m.sender_id;
    if (!lastByFriend.has(other)) lastByFriend.set(other, m);
    if (m.recipient_id === myId && !m.read_at) {
      unreadByFriend.set(other, (unreadByFriend.get(other) ?? 0) + 1);
    }
  }

  const convos: Conversation[] = friends.map((f) => ({
    friend: f.profile,
    lastMessage: lastByFriend.get(f.profile.id) ?? null,
    unread: unreadByFriend.get(f.profile.id) ?? 0,
  }));

  convos.sort((a, b) => {
    const ta = a.lastMessage ? Date.parse(a.lastMessage.created_at) : 0;
    const tb = b.lastMessage ? Date.parse(b.lastMessage.created_at) : 0;
    return tb - ta;
  });
  return convos;
}

/** The full thread with one friend, oldest first. */
export async function fetchThread(
  myId: string,
  friendId: string,
): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${myId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${myId})`,
    )
    .order("created_at", { ascending: true });
  return (data as Message[]) ?? [];
}

export async function sendMessage(
  myId: string,
  recipientId: string,
  payload: { body?: string | null; sharedItem?: SharedItem | null },
): Promise<{ error: string | null; message?: Message }> {
  const body = payload.body?.trim() ? payload.body.trim() : null;
  const shared = payload.sharedItem ?? null;
  if (!body && !shared) return { error: "Nothing to send." };
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: myId,
      recipient_id: recipientId,
      body,
      shared_item: shared,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { error: null, message: data as Message };
}

/** Mark every message this friend sent me as read. */
export async function markThreadRead(
  myId: string,
  friendId: string,
): Promise<void> {
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", myId)
    .eq("sender_id", friendId)
    .is("read_at", null);
}

export async function fetchUnreadMessageCount(myId: string): Promise<number> {
  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", myId)
    .is("read_at", null);
  return count ?? 0;
}

/** Look up a profile by handle (for the /messages/[username] thread route). */
export async function fetchProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,banner_url,bio")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  return (data as Profile) ?? null;
}

export { fetchProfilesByIds };
