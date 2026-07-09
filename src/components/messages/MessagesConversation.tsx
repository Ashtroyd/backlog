"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { fetchFriendByUsername, type FriendView } from "@/lib/social";
import { SpinnerIcon } from "@/components/icons";
import { MessageThread } from "./MessageThread";

export default function MessagesConversation({ username }: { username: string }) {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;
  const [view, setView] = useState<FriendView | null | "missing">(null);

  useEffect(() => {
    if (!myId) return;
    fetchFriendByUsername(username, myId)
      .then((v) => setView(v ?? "missing"))
      .catch(() => setView("missing"));
  }, [myId, username]);

  if (view === null) {
    return (
      <div className="flex justify-center pt-24">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (view === "missing" || view.relation === "self") {
    return (
      <div className="pt-24 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          {view === "missing" ? "No such handle" : "That's you"}
        </h1>
        <Link
          href="/messages"
          className="mt-6 inline-block rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Back to messages
        </Link>
      </div>
    );
  }

  if (view.relation !== "friends") {
    return (
      <div className="pt-16">
        <Link href="/messages" className="text-sm text-muted hover:text-ink">
          ← Messages
        </Link>
        <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center text-sm leading-relaxed text-muted">
          You can only message friends. Become friends with{" "}
          {view.profile.display_name} first.
        </div>
      </div>
    );
  }

  return <MessageThread friend={view.profile} />;
}
