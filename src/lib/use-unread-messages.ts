"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchUnreadMessageCount } from "./messages";
import { supabase } from "./supabase";

/**
 * Unread message count for the signed-in user. Realtime when the messages
 * table is in the publication (migration 0007), with a slow poll as fallback,
 * and a refresh on every navigation (e.g. after reading a thread). Called
 * once in AppShell and handed to every nav surface.
 */
export function useUnreadMessages(myId: string | null): number {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    const tick = () =>
      fetchUnreadMessageCount(myId)
        .then((n) => alive && setCount(n))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 60000);
    const channel = supabase
      .channel(`msg-badge-${myId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${myId}`,
        },
        tick,
      )
      .subscribe();
    return () => {
      alive = false;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [myId]);

  useEffect(() => {
    if (!myId) return;
    fetchUnreadMessageCount(myId).then(setCount).catch(() => {});
  }, [pathname, myId]);

  return count;
}
