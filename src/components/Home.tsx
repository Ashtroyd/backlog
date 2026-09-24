"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAllMyItems,
  fetchContinueItems,
  fetchRecentReviews,
  removeItemDirect,
  updateItemDirect,
  useAuth,
  type UpdatePatch,
} from "@/lib/backlog-store";
import {
  fetchConnections,
  fetchRecommendations,
  updateProfile,
  type Recommendation,
} from "@/lib/social";
import {
  currentMonth,
  fetchTopPicks,
  fetchTopPicksForUsers,
  monthLabel,
  type TopPick,
} from "@/lib/top-picks";
import { SECTION_BY_MEDIA, SECTIONS, type Section } from "@/lib/sections";
import { toast } from "@/lib/toast-bus";
import { removeWithUndo } from "@/lib/undo";
import type { BacklogItem, Profile } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CoverImage } from "./CoverImage";
import { DetailModal } from "./DetailModal";
import { StarRating } from "./StarRating";
import { FriendItemModal } from "./friends/FriendItemModal";
import { RecommendationModal } from "./friends/RecommendationModal";
import { TopPicksPicker } from "./TopPicksPicker";
import { TrendingSection } from "./TrendingSection";
import { EditUpNextSheet } from "./EditUpNextSheet";
import { ChevronRightIcon, PlusIcon } from "./icons";

type FriendPicks = { profile: Profile; picks: TopPick[] };

// FriendItemModal always wants a Profile, but Home.tsx has no single friend
// in scope until a pick is actually clicked — this stand-in is only ever
// passed alongside a null item, which the modal never renders.
const EMPTY_PROFILE: Profile = {
  id: "",
  username: "",
  display_name: "",
  avatar_url: null,
  banner_url: null,
  bio: null,
  home_layout: null,
};

/** Every shelf the homescreen can show, in the app's default order. */
const DEFAULT_ORDER = [
  "continue",
  "reviews",
  "friends",
  "picks",
  "trending",
] as const;
type SectionKey = (typeof DEFAULT_ORDER)[number];

const SHELF_LABELS: Record<SectionKey, string> = {
  continue: "Continue",
  reviews: "Recent Reviews",
  friends: "From Your Friends",
  picks: "Top Picks",
  trending: "Trending",
};

/** Saved layouts are a list of keys; hidden shelves are stored as
    "hidden:<key>" so older saves (no prefix) still read as all-visible. */
const HIDDEN_PREFIX = "hidden:";

/** Merges a saved layout with the current default set: drops keys the app
    no longer knows about, and appends any new ones the user has never arranged. */
function parseLayout(saved: string[] | null | undefined): {
  order: SectionKey[];
  hidden: Set<SectionKey>;
} {
  const known = new Set<string>(DEFAULT_ORDER);
  const hidden = new Set<SectionKey>();
  const kept: SectionKey[] = [];
  for (const raw of saved ?? []) {
    const isHidden = raw.startsWith(HIDDEN_PREFIX);
    const key = isHidden ? raw.slice(HIDDEN_PREFIX.length) : raw;
    if (!known.has(key) || kept.includes(key as SectionKey)) continue;
    kept.push(key as SectionKey);
    if (isHidden) hidden.add(key as SectionKey);
  }
  const missing = DEFAULT_ORDER.filter((k) => !kept.includes(k));
  return { order: [...kept, ...missing], hidden };
}

function serializeLayout(order: SectionKey[], hidden: Set<SectionKey>): string[] {
  return order.map((k) => (hidden.has(k) ? `${HIDDEN_PREFIX}${k}` : k));
}

/**
 * The app's landing page: a few quiet, high-signal shelves rather than a
 * dashboard — what you're mid-way through, recent reviews, what friends are
 * loving, and a personal highlight reel the user curates each month.
 * "Edit Up Next" reorders and hides shelves.
 */
export default function Home() {
  const { session, profile, setProfile } = useAuth();
  const myId = session?.user?.id ?? null;
  const month = currentMonth();

  const [continueItems, setContinueItems] = useState<BacklogItem[] | null>(
    null,
  );
  const [reviews, setReviews] = useState<BacklogItem[] | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [openRec, setOpenRec] = useState<Recommendation | null>(null);
  const [picks, setPicks] = useState<TopPick[] | null>(null);
  const [friendPicks, setFriendPicks] = useState<FriendPicks[] | null>(null);
  const [openFriendPick, setOpenFriendPick] = useState<{
    item: BacklogItem;
    profile: Profile;
  } | null>(null);
  const [allItems, setAllItems] = useState<BacklogItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Opening a title from a shelf shows its review right here — no navigating
  // to the section page first. `openSection` only updates when a new item is
  // opened (not on close), so it stays correct through the close animation.
  const [openItem, setOpenItem] = useState<BacklogItem | null>(null);
  const [openSection, setOpenSection] = useState<Section | null>(null);

  // Seeded from the profile's saved layout once it arrives (profile loads
  // asynchronously, so this can't just be a lazy useState initializer).
  const [layout, setLayout] = useState(() => parseLayout(null));
  const [editOpen, setEditOpen] = useState(false);
  // Bumped on each open so the edit sheet starts from the saved layout.
  const [editSession, setEditSession] = useState(0);
  const layoutInitialized = useRef(false);
  useEffect(() => {
    if (profile && !layoutInitialized.current) {
      layoutInitialized.current = true;
      setLayout(parseLayout(profile.home_layout));
    }
  }, [profile]);

  function openItemModal(item: BacklogItem) {
    setOpenSection(SECTION_BY_MEDIA[item.media_type]);
    setOpenItem(item);
  }

  /** Patches an item wherever it appears on the homescreen's own shelves. */
  function patchLocalItem(id: string, fields: Partial<BacklogItem>) {
    setContinueItems(
      (prev) =>
        prev?.map((i) => (i.id === id ? { ...i, ...fields } : i)) ?? prev,
    );
    setReviews(
      (prev) =>
        prev?.map((i) => (i.id === id ? { ...i, ...fields } : i)) ?? prev,
    );
    setPicks(
      (prev) =>
        prev?.map((p) =>
          p.item.id === id ? { ...p, item: { ...p.item, ...fields } } : p,
        ) ?? prev,
    );
  }

  async function saveItem(item: BacklogItem, patch: UpdatePatch) {
    const result = await updateItemDirect(item, patch);
    if (!result.error) {
      patchLocalItem(item.id, result.fields as Partial<BacklogItem>);
      if (patch.status && patch.status !== "in_progress") {
        setContinueItems(
          (prev) => prev?.filter((i) => i.id !== item.id) ?? prev,
        );
      }
    }
    return result;
  }

  async function handleModalUpdate(id: string, patch: UpdatePatch) {
    if (!openItem || openItem.id !== id)
      return { error: "Title no longer open." };
    return saveItem(openItem, patch);
  }

  /** Remove with an Undo toast: off the shelves now, deleted after the window. */
  async function handleModalRemove(id: string) {
    const title = openItem?.id === id ? openItem.title : "title";
    // This handler is recreated each render, so these are the current shelves.
    const before = { c: continueItems, r: reviews, p: picks };
    removeWithUndo({
      message: `Removed ${title}`,
      hide: () => {
        setContinueItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
        setReviews((prev) => prev?.filter((i) => i.id !== id) ?? prev);
        setPicks((prev) => prev?.filter((p) => p.item.id !== id) ?? prev);
      },
      restore: () => {
        setContinueItems(before.c);
        setReviews(before.r);
        setPicks(before.p);
      },
      commit: () => removeItemDirect(id),
    });
    return { error: null };
  }

  const loadPicks = useCallback(
    () => (myId ? fetchTopPicks(myId, month).then(setPicks) : Promise.resolve()),
    [myId, month],
  );

  useEffect(() => {
    if (!myId) return;
    fetchContinueItems(myId).then(setContinueItems);
    fetchRecentReviews(myId).then(setReviews);
    fetchConnections(myId).then((c) => {
      fetchRecommendations(myId, c.friends).then(setRecs);
      const friendIds = c.friends.map((f) => f.profile.id);
      fetchTopPicksForUsers(friendIds, month).then((byUser) => {
        setFriendPicks(
          c.friends
            .map((f) => ({
              profile: f.profile,
              picks: byUser.get(f.profile.id) ?? [],
            }))
            .filter((f) => f.picks.length > 0),
        );
      });
    });
    loadPicks();
  }, [myId, month, loadPicks]);

  function openPicker() {
    if (!myId) return;
    fetchAllMyItems(myId).then(setAllItems);
    setPickerOpen(true);
  }

  function hasContent(key: SectionKey): boolean {
    switch (key) {
      case "continue":
        return !!continueItems && continueItems.length > 0;
      case "reviews":
        return !!reviews && reviews.length > 0;
      case "friends":
        return !!recs && recs.length > 0;
      case "picks":
        return true;
      case "trending":
        return !!myId;
    }
  }

  function saveLayout(order: SectionKey[], hidden: Set<SectionKey>) {
    setLayout({ order, hidden });
    if (!myId) return;
    updateProfile(myId, { home_layout: serializeLayout(order, hidden) }).then(
      ({ profile: updated }) => {
        if (updated) setProfile(updated);
      },
    );
  }

  function renderSection(key: SectionKey): React.ReactNode {
    switch (key) {
      case "continue":
        return continueItems && continueItems.length > 0 ? (
          <HomeSection title="Continue">
            <Shelf>
              {continueItems.map((item) => (
                <ContinueCard
                  key={item.id}
                  item={item}
                  onOpen={() => openItemModal(item)}
                  onSave={saveItem}
                />
              ))}
            </Shelf>
          </HomeSection>
        ) : null;

      case "reviews":
        return reviews && reviews.length > 0 ? (
          <HomeSection title="Recent Reviews">
            <Shelf>
              {reviews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItemModal(item)}
                  className="flex w-80 shrink-0 snap-start gap-4 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
                >
                  <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-ivory">
                    <CoverImage
                      src={item.cover_url}
                      title={item.title}
                      sizes="80px"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium text-ink">
                      {item.title}
                    </p>
                    {item.rating != null && (
                      <div className="mt-1.5">
                        <StarRating value={item.rating} size={12} />
                      </div>
                    )}
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-body">
                      {item.review ?? item.current_thoughts}
                    </p>
                  </div>
                </button>
              ))}
            </Shelf>
          </HomeSection>
        ) : null;

      case "friends":
        return recs && recs.length > 0 ? (
          <HomeSection
            title="From Your Friends"
           
            action={
              <Link
                href="/friends"
                className="flex min-h-11 items-center gap-0.5 text-subhead text-accent hover:text-accent-hover"
              >
                See All
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            }
          >
            <Shelf>
              {recs.slice(0, 6).map((r) => {
                const names = r.raters.map((x) => x.profile.display_name);
                const label =
                  names.length === 1
                    ? names[0]
                    : `${names[0]} +${names.length - 1}`;
                return (
                  <ShelfCard
                    key={`${r.item.media_type}:${r.item.external_id}`}
                    onClick={() => setOpenRec(r)}
                    coverUrl={r.item.cover_url}
                    title={r.item.title}
                    ratingValue={Math.round(r.avg * 2) / 2}
                    subtitle={label}
                  />
                );
              })}
            </Shelf>
          </HomeSection>
        ) : null;

      case "picks":
        return (
          <HomeSection
            title={`Top Picks · ${monthLabel(month)}`}
           
            action={
              picks && picks.length > 0 ? (
                <button
                  type="button"
                  onClick={openPicker}
                  className="min-h-11 text-subhead text-accent hover:text-accent-hover"
                >
                  Edit
                </button>
              ) : null
            }
          >
            {picks == null ? null : picks.length === 0 ? (
              <button
                type="button"
                onClick={openPicker}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-8 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <PlusIcon className="h-4 w-4" />
                Choose up to 5 favourites to feature this month
              </button>
            ) : (
              <Shelf>
                {picks.map((p) => (
                  <ShelfCard
                    key={p.id}
                    onClick={() => openItemModal(p.item)}
                    coverUrl={p.item.cover_url}
                    title={p.item.title}
                    ratingValue={p.item.rating}
                    subtitle={SECTION_BY_MEDIA[p.item.media_type].label}
                  />
                ))}
              </Shelf>
            )}

            {friendPicks && friendPicks.length > 0 && (
              <div className="mt-8 space-y-6">
                {friendPicks.map((f) => (
                  <div key={f.profile.id}>
                    <Link
                      href={`/friends/${f.profile.username}`}
                      className="mb-2.5 flex w-fit items-center gap-2 text-sm font-medium text-ink transition-colors hover:text-accent"
                    >
                      <Avatar profile={f.profile} size={22} />
                      {f.profile.display_name}
                    </Link>
                    <Shelf>
                      {f.picks.map((p) => (
                        <ShelfCard
                          key={p.id}
                          onClick={() =>
                            setOpenFriendPick({
                              item: p.item,
                              profile: f.profile,
                            })
                          }
                          coverUrl={p.item.cover_url}
                          title={p.item.title}
                          ratingValue={p.item.rating}
                          subtitle={SECTION_BY_MEDIA[p.item.media_type].label}
                        />
                      ))}
                    </Shelf>
                  </div>
                ))}
              </div>
            )}
          </HomeSection>
        );

      case "trending":
        return myId ? (
          <TrendingSection userId={myId} />
        ) : null;
    }
  }

  if (!profile) return null;

  const visible = layout.order.filter(
    (k) => !layout.hidden.has(k) && hasContent(k),
  );
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="pb-4 pt-10 sm:pt-12">
      <p className="text-footnote font-semibold uppercase tracking-wide text-muted">
        {today}
      </p>
      <h1 className="mt-0.5 font-display text-4xl font-bold tracking-tight text-ink">
        Up Next
      </h1>

      {visible.map((key) => (
        <Fragment key={key}>{renderSection(key)}</Fragment>
      ))}

      <div className="mt-14 flex justify-center">
        <button
          type="button"
          onClick={() => {
            setEditSession((n) => n + 1);
            setEditOpen(true);
          }}
          className="min-h-11 rounded-full bg-ivory px-5 text-subhead font-medium text-accent transition-colors hover:bg-line"
        >
          Edit Up Next
        </button>
      </div>

      <EditUpNextSheet
        key={editSession}
        open={editOpen}
        order={layout.order}
        hidden={layout.hidden}
        labels={SHELF_LABELS}
        onClose={() => setEditOpen(false)}
        onSave={saveLayout}
      />

      <DetailModal
        item={openItem}
        section={openSection ?? SECTIONS.games}
        onClose={() => setOpenItem(null)}
        onUpdate={handleModalUpdate}
        onRemove={handleModalRemove}
      />

      <FriendItemModal
        item={openFriendPick?.item ?? null}
        profile={openFriendPick?.profile ?? EMPTY_PROFILE}
        mine={null}
        onClose={() => setOpenFriendPick(null)}
      />

      <RecommendationModal
        rec={openRec}
        onClose={() => setOpenRec(null)}
        onAdded={(key) => {
          setRecs((prev) =>
            (prev ?? []).filter(
              (r) => `${r.item.media_type}:${r.item.external_id}` !== key,
            ),
          );
          setOpenRec(null);
        }}
      />

      {myId && (
        <TopPicksPicker
          open={pickerOpen}
          items={allItems}
          initial={picks ?? []}
          userId={myId}
          month={month}
          onClose={() => setPickerOpen(false)}
          onSaved={async () => {
            setPickerOpen(false);
            await loadPicks();
          }}
        />
      )}
    </div>
  );
}

function HomeSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="shelf-scrollbar flex snap-x snap-proximity gap-4 overflow-x-auto pb-2">
      {children}
    </div>
  );
}

function ShelfCard({
  href,
  onClick,
  coverUrl,
  title,
  subtitle,
  ratingValue,
}: {
  href?: string;
  onClick?: () => void;
  coverUrl: string | null;
  title: string;
  subtitle?: React.ReactNode;
  ratingValue?: number | null;
}) {
  const content = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-ivory shadow-[0_1px_2px_rgba(38,37,33,0.06)] transition-shadow duration-300 group-hover:shadow-[0_12px_28px_rgba(38,37,33,0.14)]">
        <CoverImage
          src={coverUrl}
          title={title}
          sizes="144px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <p className="mt-2.5 truncate px-0.5 text-sm font-medium text-ink">
        {title}
      </p>
      {ratingValue != null && (
        <div className="mt-0.5 px-0.5">
          <StarRating value={ratingValue} size={11} />
        </div>
      )}
      {subtitle && (
        <p className="mt-0.5 truncate px-0.5 text-xs text-muted">{subtitle}</p>
      )}
    </>
  );
  const className = "group block w-28 shrink-0 snap-start text-left sm:w-32";
  return href ? (
    <Link href={href} className={className} title={title}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className} title={title}>
      {content}
    </button>
  );
}

function ContinueCard({
  item,
  onOpen,
  onSave,
}: {
  item: BacklogItem;
  onOpen: () => void;
  onSave: (
    item: BacklogItem,
    patch: UpdatePatch,
  ) => Promise<{ error: string | null }>;
}) {
  const [busy, setBusy] = useState(false);
  const episodic = item.media_type === "anime" || item.media_type === "series";
  const total =
    item.meta?.episodes && item.meta.episodes > 0 ? item.meta.episodes : null;
  const watched = item.progress ?? 0;
  const label = episodic
    ? `${watched}${total ? ` / ${total}` : ""} episodes`
    : item.hours_played != null
      ? `${item.hours_played} hrs played`
      : item.live_service
        ? "Live service"
        : SECTION_BY_MEDIA[item.media_type].label;
  async function increment() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onSave(item, { progress: watched + 1 });
      if (result.error) toast("error", "Couldn't update progress. Try again.");
    } catch {
      toast("error", "Couldn't update progress. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const fraction =
    episodic && total ? Math.min(1, Math.max(0, watched / total)) : null;
  const caughtUp = total != null && watched >= total;

  // TV-app "Up Next" card: landscape, the poster over a blurred wash of
  // itself, progress along the bottom, +1 right on the artwork.
  return (
    <div className="group relative aspect-video w-72 shrink-0 snap-start overflow-hidden rounded-xl bg-ink shadow-[0_2px_10px_rgba(0,0,0,0.18)] sm:w-80">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.title}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-offset-4"
      />
      {item.cover_url && (
        <Image
          src={item.cover_url}
          alt=""
          aria-hidden
          fill
          sizes="320px"
          className="scale-125 object-cover opacity-80 blur-xl saturate-150"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />
      <div className="absolute inset-3 flex gap-3.5">
        <div className="relative aspect-[2/3] h-full shrink-0 overflow-hidden rounded-md bg-ivory shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
          <CoverImage src={item.cover_url} title={item.title} sizes="96px" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-end pr-8 text-white">
        <p className="line-clamp-2 text-subhead font-semibold leading-snug">
          {item.title}
        </p>
        <p className="mt-0.5 text-footnote tabular-nums text-white/75">{label}</p>
        {fraction != null && (
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/30">
            <span
              className="block h-full rounded-full bg-white"
              style={{ width: `${Math.max(fraction * 100, 3)}%` }}
            />
          </span>
        )}
        </div>
      </div>
      {episodic && (
        <button
          type="button"
          disabled={busy || caughtUp}
          onClick={increment}
          aria-label={
            caughtUp
              ? `${item.title}: caught up`
              : `Add one episode watched for ${item.title}`
          }
          className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-60"
        >
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/25 px-2 text-footnote font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/40">
            {busy ? "…" : caughtUp ? "✓" : "+1"}
          </span>
        </button>
      )}
    </div>
  );
}
