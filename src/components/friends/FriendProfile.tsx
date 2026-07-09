"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/backlog-store";
import {
  acceptRequest,
  computeTasteMatch,
  fetchFavorites,
  fetchFriendByUsername,
  fetchUserItems,
  removeFriendship,
  sendFriendRequest,
  type FriendView,
} from "@/lib/social";
import type { BacklogItem } from "@/lib/types";
import { SpinnerIcon, UserPlusIcon } from "@/components/icons";
import { FriendLibrary } from "./FriendLibrary";
import { TasteMatchCard } from "./TasteMatchCard";
import { ProfileHero } from "./ProfileHero";
import { FavouritesRow } from "./FavouritesRow";

export default function FriendProfile({ username }: { username: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const myId = session?.user?.id ?? null;

  const [view, setView] = useState<FriendView | null | "missing">(null);
  const [theirItems, setTheirItems] = useState<BacklogItem[]>([]);
  const [myItems, setMyItems] = useState<BacklogItem[]>([]);
  const [theirFavorites, setTheirFavorites] = useState<BacklogItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const v = await fetchFriendByUsername(username, myId);
    if (!v) {
      setView("missing");
      return;
    }
    setView(v);
    if (v.relation === "friends" || v.relation === "self") {
      const [theirs, mine, favs] = await Promise.all([
        fetchUserItems(v.profile.id),
        v.relation === "friends" ? fetchUserItems(myId) : Promise.resolve([]),
        fetchFavorites(v.profile.id),
      ]);
      setTheirItems(theirs);
      setMyItems(mine);
      setTheirFavorites(favs);
    }
  }, [username, myId]);

  useEffect(() => {
    load();
  }, [load]);

  const myItemsByKey = useMemo(
    () => new Map(myItems.map((i) => [`${i.media_type}:${i.external_id}`, i])),
    [myItems],
  );
  const taste = useMemo(
    () => computeTasteMatch(myItems, theirItems),
    [myItems, theirItems],
  );

  if (view === null) {
    return (
      <div className="flex justify-center pt-24">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (view === "missing") {
    return (
      <div className="pt-24 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">No such handle</h1>
        <p className="mt-2 text-sm text-muted">
          There&apos;s no one here with the handle @{username}.
        </p>
        <Link
          href="/friends"
          className="mt-6 inline-block rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Back to friends
        </Link>
      </div>
    );
  }

  const { profile, relation, friendshipId } = view;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    await fn();
    setBusy(false);
    load();
  }

  return (
    <div className="pt-12">
      <Link
        href="/friends"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Friends
      </Link>

      <div className="mt-4">
        <ProfileHero
          profile={profile}
          actions={
            <>
              {relation === "none" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => sendFriendRequest(myId!, profile.id))}
                  className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  <UserPlusIcon className="h-4 w-4" /> Add friend
                </button>
              )}
              {relation === "outgoing" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => removeFriendship(friendshipId!))}
                  className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-ivory hover:text-ink disabled:opacity-60"
                >
                  Requested · Cancel
                </button>
              )}
              {relation === "incoming" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => acceptRequest(friendshipId!))}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  Accept request
                </button>
              )}
              {relation === "friends" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Remove ${profile.display_name} as a friend?`)) {
                      act(() => removeFriendship(friendshipId!));
                    }
                  }}
                  className="rounded-full border border-line px-4 py-2 text-sm font-medium text-body transition-colors hover:bg-ivory disabled:opacity-60"
                >
                  Friends ✓
                </button>
              )}
              {relation === "self" && (
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="rounded-full border border-line px-4 py-2 text-sm font-medium text-body transition-colors hover:bg-ivory"
                >
                  Edit profile
                </button>
              )}
            </>
          }
        />
      </div>

      {(relation === "friends" || relation === "self") && (
        <div className="mt-10 space-y-10">
          {theirFavorites.length > 0 && (
            <section>
              <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
                Favourites
              </h2>
              <FavouritesRow favorites={theirFavorites} />
            </section>
          )}
          {relation === "friends" && (
            <TasteMatchCard match={taste} friendName={profile.display_name} />
          )}
          <FriendLibrary
            items={theirItems}
            profile={profile}
            myItemsByKey={relation === "friends" ? myItemsByKey : new Map()}
          />
        </div>
      )}

      {(relation === "none" || relation === "outgoing" || relation === "incoming") && (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-sm leading-relaxed text-muted">
            {relation === "incoming"
              ? `${profile.display_name} sent you a friend request. Accept it to see their backlog and ratings.`
              : relation === "outgoing"
                ? `Waiting for ${profile.display_name} to accept your request. Once they do, you'll see their backlog here.`
                : `Become friends with ${profile.display_name} to see their backlog, ratings and reviews.`}
          </p>
        </div>
      )}
    </div>
  );
}
