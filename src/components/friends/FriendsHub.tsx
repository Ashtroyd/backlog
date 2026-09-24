"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/backlog-store";
import {
  acceptRequest,
  fetchConnections,
  fetchFriendStats,
  fetchRecommendations,
  removeFriendship,
  searchProfiles,
  sendFriendRequest,
  type Connection,
  type FriendStat,
  type Recommendation,
} from "@/lib/social";
import type { Profile } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { StarRating } from "@/components/StarRating";
import { RecommendationModal } from "./RecommendationModal";
import {
  CheckIcon,
  SearchIcon,
  SpinnerIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons";

export default function FriendsHub() {
  const { session, profile } = useAuth();
  const myId = session?.user?.id ?? null;

  const [friends, setFriends] = useState<Connection[]>([]);
  const [incoming, setIncoming] = useState<Connection[]>([]);
  const [outgoing, setOutgoing] = useState<Connection[]>([]);
  const [stats, setStats] = useState<Map<string, FriendStat>>(new Map());
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [openRec, setOpenRec] = useState<Recommendation | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const conns = await fetchConnections(myId);
    setFriends(conns.friends);
    setIncoming(conns.incoming);
    setOutgoing(conns.outgoing);
    setLoaded(true);
    const [s, r] = await Promise.all([
      fetchFriendStats(conns.friends),
      fetchRecommendations(myId, conns.friends),
    ]);
    setStats(s);
    setRecs(r);
  }, [myId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  return (
    <div className="pt-12">
      {/* Your profile */}
      <header className="flex items-center gap-4">
        <Avatar profile={profile} size={56} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight text-ink">
            {profile.display_name}
          </h1>
          <p className="truncate text-sm text-muted">@{profile.username}</p>
        </div>
      </header>

      <AddFriend myId={myId!} onChanged={load} existing={friends} outgoing={outgoing} />

      {incoming.length > 0 && (
        <Section title="Friend requests">
          <ul className="space-y-2">
            {incoming.map((c) => (
              <RequestRow key={c.friendshipId} conn={c} onChanged={load} incoming />
            ))}
          </ul>
        </Section>
      )}

      <Section
        title={`Friends${friends.length ? ` · ${friends.length}` : ""}`}
      >
        {!loaded ? null : friends.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            You haven&apos;t added anyone yet. Search a handle above to send your
            first friend request.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((c) => (
              <FriendCard key={c.friendshipId} conn={c} stat={stats.get(c.profile.id)} />
            ))}
          </div>
        )}
        {outgoing.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Pending:</span>
            {outgoing.map((c) => (
              <span
                key={c.friendshipId}
                className="rounded-full bg-ivory px-2.5 py-1 text-xs text-body"
              >
                @{c.profile.username}
              </span>
            ))}
          </div>
        )}
      </Section>

      {recs.length > 0 && (
        <Section title="From your friends">
          <p className="-mt-1 mb-4 text-sm text-muted">
            Highly rated by friends, not in your backlog yet.
          </p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {recs.map((r) => (
              <RecommendationCard
                key={`${r.item.media_type}:${r.item.external_id}`}
                rec={r}
                onOpen={() => setOpenRec(r)}
              />
            ))}
          </div>
        </Section>
      )}

      <RecommendationModal
        rec={openRec}
        onClose={() => setOpenRec(null)}
        onAdded={(key) => {
          setRecs((prev) =>
            prev.filter((r) => `${r.item.media_type}:${r.item.external_id}` !== key),
          );
          setOpenRec(null);
        }}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-display text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function AddFriend({
  myId,
  onChanged,
  existing,
  outgoing,
}: {
  myId: string;
  onChanged: () => void;
  existing: Connection[];
  outgoing: Connection[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  const knownIds = new Set([
    ...existing.map((c) => c.profile.id),
    ...outgoing.map((c) => c.profile.id),
  ]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchProfiles(q, myId);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, myId]);

  async function add(p: Profile) {
    setNote(null);
    const { error, accepted } = await sendFriendRequest(myId, p.id);
    if (error) {
      setNote(error);
      return;
    }
    setSentIds((prev) => new Set(prev).add(p.id));
    setNote(
      accepted
        ? `You're now friends with ${p.display_name}.`
        : `Request sent to ${p.display_name}.`,
    );
    onChanged();
  }

  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3.5 py-2.5">
        <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a friend by their @handle…"
          aria-label="Add a friend by their handle"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full bg-transparent text-subhead text-ink placeholder:text-muted/70"
        />
        {searching && <SpinnerIcon className="h-4 w-4 shrink-0 animate-spin text-muted" />}
      </div>

      {note && (
        <p className="mt-2 px-1 text-sm text-sage">{note}</p>
      )}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden"
          >
            {results.map((p) => {
              const already = knownIds.has(p.id) || sentIds.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-1 py-2">
                  <Link
                    href={`/friends/${p.username}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar profile={p} size={38} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {p.display_name}
                      </p>
                      <p className="truncate text-xs text-muted">@{p.username}</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={already}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-footnote font-medium transition-colors ${
                      already
                        ? "bg-sage-soft text-sage"
                        : "border border-line text-ink hover:border-line-strong hover:bg-ivory"
                    }`}
                  >
                    {already ? (
                      <>
                        <CheckIcon className="h-3.5 w-3.5" /> Sent
                      </>
                    ) : (
                      <>
                        <UserPlusIcon className="h-3.5 w-3.5" /> Add
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function RequestRow({
  conn,
  onChanged,
  incoming,
}: {
  conn: Connection;
  onChanged: () => void;
  incoming: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    await acceptRequest(conn.friendshipId);
    setBusy(false);
    onChanged();
  }
  async function remove() {
    setBusy(true);
    await removeFriendship(conn.friendshipId);
    setBusy(false);
    onChanged();
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <Link href={`/friends/${conn.profile.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar profile={conn.profile} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{conn.profile.display_name}</p>
          <p className="truncate text-xs text-muted">@{conn.profile.username}</p>
        </div>
      </Link>
      {incoming && (
        <button
          type="button"
          onClick={accept}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-footnote font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          <CheckIcon className="h-3.5 w-3.5" /> Accept
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        title={incoming ? "Decline" : "Cancel"}
        className="relative flex h-8 w-8 items-center justify-center rounded-full after:absolute after:-inset-1.5 text-muted transition-colors hover:bg-ivory hover:text-ink disabled:opacity-60"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </li>
  );
}

function FriendCard({
  conn,
  stat,
}: {
  conn: Connection;
  stat: FriendStat | undefined;
}) {
  return (
    <Link
      href={`/friends/${conn.profile.username}`}
      className="group flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-[0_8px_24px_rgba(38,37,33,0.10)]"
    >
      <Avatar profile={conn.profile} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{conn.profile.display_name}</p>
        <p className="truncate text-xs text-muted">@{conn.profile.username}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <span>{stat ? `${stat.total} titles` : "…"}</span>
          {stat && stat.total > 0 && <span>· {stat.completed} done</span>}
          {stat?.avgRating != null && (
            <span className="inline-flex items-center gap-1">
              · <StarRating value={Math.round(stat.avgRating * 2) / 2} size={11} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function RecommendationCard({
  rec,
  onOpen,
}: {
  rec: Recommendation;
  onOpen: () => void;
}) {
  const { item } = rec;
  const names = rec.raters.map((r) => r.profile.display_name);
  const label =
    names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;

  return (
    <button type="button" onClick={onOpen} className="group text-left" title={item.title}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-ivory shadow-[0_1px_2px_rgba(38,37,33,0.06)] transition-shadow duration-300 group-hover:shadow-[0_12px_28px_rgba(38,37,33,0.14)]">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-4xl text-line-strong">
            {item.title.charAt(0)}
          </div>
        )}
      </div>
      <p className="mt-2.5 truncate px-0.5 text-sm font-medium text-ink">{item.title}</p>
      <div className="mt-0.5 flex items-center gap-1.5 px-0.5 text-xs text-muted">
        <StarRating value={Math.round(rec.avg * 2) / 2} size={11} />
        <span className="truncate">{label}</span>
      </div>
    </button>
  );
}
