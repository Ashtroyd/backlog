"use client";

import { useUnread } from "@/lib/nav-context";
import { SegmentedNav } from "./SegmentedNav";

/** Large "Friends" title plus the People · Messages · Shared switcher. */
export function FriendsTabs({
  active,
}: {
  active: "people" | "messages" | "shared";
}) {
  const unread = useUnread();
  return (
    <header className="pt-10 sm:pt-12">
      <h1 className="font-display text-4xl font-bold tracking-tight text-ink">
        Friends
      </h1>
      <div className="mt-4">
        <SegmentedNav
          id="friends"
          label="Friends sections"
          segments={[
            { href: "/friends", label: "People", active: active === "people" },
            {
              href: "/messages",
              label: "Messages",
              active: active === "messages",
              badge: unread,
            },
            { href: "/shared", label: "Shared", active: active === "shared" },
          ]}
        />
      </div>
    </header>
  );
}
