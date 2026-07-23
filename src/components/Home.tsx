"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import {
  fetchAllMyItems,
  fetchContinueItems,
  fetchRecentReviews,
  removeItemDirect,
  updateItemDirect,
  useAuth,
  type UpdatePatch,
} from "@/lib/backlog-store";
import { fetchConnections, fetchRecommendations, updateProfile, type Recommendation } from "@/lib/social";
import {
  currentMonth,
  fetchTopPicks,
  fetchTopPicksForUsers,
  monthLabel,
  type TopPick,
} from "@/lib/top-picks";
import { SECTION_BY_MEDIA, SECTIONS, type Section } from "@/lib/sections";
import { toast } from "@/lib/toast-bus";
import type { BacklogItem, Profile } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CoverImage } from "./CoverImage";
import { DetailModal } from "./DetailModal";
import { StarRating } from "./StarRating";
import { FriendItemModal } from "./friends/FriendItemModal";
import { RecommendationModal } from "./friends/RecommendationModal";
import { TopPicksPicker } from "./TopPicksPicker";
import { TrendingSection } from "./TrendingSection";
import { GripIcon, PlusIcon } from "./icons";

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
const DEFAULT_ORDER = ["continue", "reviews", "friends", "picks", "trending"] as const;
type SectionKey = (typeof DEFAULT_ORDER)[number];

/** Merges a saved order with the current default set: drops keys the app no
    longer knows about, and appends any new ones the user has never arranged. */
function normalizeOrder(saved: string[] | null | undefined): SectionKey[] {
  const known = new Set<string>(DEFAULT_ORDER);
  const kept = (saved ?? []).filter((k): k is SectionKey => known.has(k));
  const missing = DEFAULT_ORDER.filter((k) => !kept.includes(k));
  return [...kept, ...missing];
}

/** Re-applies a reordering of the *visible* subset onto the full key list,
    leaving currently-hidden sections exactly where they were. */
function mergeReorder(fullOrder: SectionKey[], reorderedVisible: SectionKey[]): SectionKey[] {
  const visible = new Set(reorderedVisible);
  let vi = 0;
  return fullOrder.map((key) => (visible.has(key) ? reorderedVisible[vi++] : key));
}

/**
 * The app's landing page: a few quiet, high-signal shelves rather than a
 * dashboard — what you're mid-way through, recent reviews, what friends are
 * loving, and a personal highlight reel the user curates each month. The
 * user can drag shelves into whatever order suits them.
 */
export default function Home() {
  const { session, profile, setProfile } = useAuth();
  const myId = session?.user?.id ?? null;
  const month = currentMonth();

  const [continueItems, setContinueItems] = useState<BacklogItem[] | null>(null);
  const [reviews, setReviews] = useState<BacklogItem[] | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [openRec, setOpenRec] = useState<Recommendation | null>(null);
  const [picks, setPicks] = useState<TopPick[] | null>(null);
  const [friendPicks, setFriendPicks] = useState<FriendPicks[] | null>(null);
  const [openFriendPick, setOpenFriendPick] = useState<{ item: BacklogItem; profile: Profile } | null>(
    null,
  );
  const [allItems, setAllItems] = useState<BacklogItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Opening a title from a shelf shows its review right here — no navigating
  // to the section page first. `openSection` only updates when a new item is
  // opened (not on close), so it stays correct through the close animation.
  const [openItem, setOpenItem] = useState<BacklogItem | null>(null);
  const [openSection, setOpenSection] = useState<Section | null>(null);

  // Seeded from the profile's saved layout once it arrives (profile loads
  // asynchronously, so this can't just be a lazy useState initializer).
  const [order, setOrder] = useState<SectionKey[]>(() => normalizeOrder(null));
  const orderInitialized = useRef(false);
  const orderRef = useRef(order);
  useEffect(() => {
    if (profile && !orderInitialized.current) {
      orderInitialized.current = true;
      const next = normalizeOrder(profile.home_layout);
      orderRef.current = next;
      setOrder(next);
    }
  }, [profile]);

  function openItemModal(item: BacklogItem) {
    setOpenSection(SECTION_BY_MEDIA[item.media_type]);
    setOpenItem(item);
  }

  /** Patches an item wherever it appears on the homescreen's own shelves. */
  function patchLocalItem(id: string, fields: Partial<BacklogItem>) {
    setContinueItems((prev) => prev?.map((i) => (i.id === id ? { ...i, ...fields } : i)) ?? prev);
    setReviews((prev) => prev?.map((i) => (i.id === id ? { ...i, ...fields } : i)) ?? prev);
    setPicks((prev) =>
      prev?.map((p) => (p.item.id === id ? { ...p, item: { ...p.item, ...fields } } : p)) ?? prev,
    );
  }

  function handleModalUpdate(id: string, patch: UpdatePatch) {
    const item = openItem;
    if (!item || item.id !== id) return;
    updateItemDirect(item, patch).then(({ error, fields }) => {
      if (error) {
        toast("error", "Couldn't save your changes — check your connection.");
        return;
      }
      patchLocalItem(id, fields as Partial<BacklogItem>);
    });
  }

  function handleModalRemove(id: string) {
    setContinueItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    setReviews((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    setPicks((prev) => prev?.filter((p) => p.item.id !== id) ?? prev);
    removeItemDirect(id).then(({ error }) => {
      if (error) toast("error", "Couldn't remove that — check your connection.");
    });
  }

  const loadPicks = useCallback(async () => {
    if (!myId) return;
    setPicks(await fetchTopPicks(myId, month));
  }, [myId, month]);

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
            .map((f) => ({ profile: f.profile, picks: byUser.get(f.profile.id) ?? [] }))
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

  function handleReorder(reorderedVisible: SectionKey[]) {
    const next = mergeReorder(orderRef.current, reorderedVisible);
    orderRef.current = next;
    setOrder(next);
  }

  function persistOrder() {
    if (!myId) return;
    updateProfile(myId, { home_layout: orderRef.current }).then(({ profile: updated }) => {
      if (updated) setProfile(updated);
    });
  }

  function renderSection(key: SectionKey, dragHandle: React.ReactNode): React.ReactNode {
    switch (key) {
      case "continue":
        return continueItems && continueItems.length > 0 ? (
          <HomeSection title="Continue" dragHandle={dragHandle}>
            <Shelf>
              {continueItems.map((item) => (
                <ShelfCard
                  key={item.id}
                  onClick={() => openItemModal(item)}
                  coverUrl={item.cover_url}
                  title={item.title}
                  ratingValue={item.rating}
                  subtitle={SECTION_BY_MEDIA[item.media_type].label}
                />
              ))}
            </Shelf>
          </HomeSection>
        ) : null;

      case "reviews":
        return reviews && reviews.length > 0 ? (
          <HomeSection title="Recent reviews" dragHandle={dragHandle}>
            <Shelf>
              {reviews.map((item) => (
                <ShelfCard
                  key={item.id}
                  onClick={() => openItemModal(item)}
                  coverUrl={item.cover_url}
                  title={item.title}
                  ratingValue={item.rating}
                  subtitle={<span className="italic">{item.review ?? item.current_thoughts}</span>}
                />
              ))}
            </Shelf>
          </HomeSection>
        ) : null;

      case "friends":
        return recs && recs.length > 0 ? (
          <HomeSection
            title="From your friends"
            dragHandle={dragHandle}
            action={
              <Link href="/friends" className="text-sm font-medium text-accent hover:text-accent-hover">
                See all
              </Link>
            }
          >
            <Shelf>
              {recs.slice(0, 6).map((r) => {
                const names = r.raters.map((x) => x.profile.display_name);
                const label = names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
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
            title={`Top picks · ${monthLabel(month)}`}
            dragHandle={dragHandle}
            action={
              picks && picks.length > 0 ? (
                <button
                  type="button"
                  onClick={openPicker}
                  className="text-sm font-medium text-accent hover:text-accent-hover"
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
                          onClick={() => setOpenFriendPick({ item: p.item, profile: f.profile })}
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
        return myId ? <TrendingSection userId={myId} dragHandle={dragHandle} /> : null;
    }
  }

  if (!profile) return null;

  const visibleOrder = order.filter(hasContent);

  return (
    <div className="pt-12 pb-4">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">
        Welcome back, {profile.display_name.split(" ")[0]}
      </h1>

      <Reorder.Group as="div" axis="y" values={visibleOrder} onReorder={handleReorder}>
        {visibleOrder.map((key) => (
          <DraggableSection key={key} value={key} onDragEnd={persistOrder}>
            {(handle) => renderSection(key, handle)}
          </DraggableSection>
        ))}
      </Reorder.Group>

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
            (prev ?? []).filter((r) => `${r.item.media_type}:${r.item.external_id}` !== key),
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

/** Wraps one homescreen shelf as a drag-reorderable item; the drag handle it
    hands back only starts a drag when grabbed directly, so shelf scrolling
    and card clicks are untouched. */
function DraggableSection({
  value,
  onDragEnd,
  children,
}: {
  value: SectionKey;
  onDragEnd: () => void;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const controls = useDragControls();
  const handle = (
    <button
      type="button"
      onPointerDown={(e) => controls.start(e)}
      aria-label="Drag to reorder"
      style={{ touchAction: "none" }}
      className="-ml-1 mr-0.5 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted/50 transition-colors hover:bg-ivory hover:text-muted active:cursor-grabbing"
    >
      <GripIcon className="h-4 w-4" />
    </button>
  );
  return (
    <Reorder.Item value={value} as="div" dragListener={false} dragControls={controls} onDragEnd={onDragEnd}>
      {children(handle)}
    </Reorder.Item>
  );
}

function HomeSection({
  title,
  action,
  dragHandle,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  dragHandle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center">
          {dragHandle}
          <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Shelf({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{children}</div>;
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
      <p className="mt-2.5 truncate px-0.5 text-sm font-medium text-ink">{title}</p>
      {ratingValue != null && (
        <div className="mt-0.5 px-0.5">
          <StarRating value={ratingValue} size={11} />
        </div>
      )}
      {subtitle && <p className="mt-0.5 truncate px-0.5 text-xs text-muted">{subtitle}</p>}
    </>
  );
  const className = "group block w-28 shrink-0 text-left sm:w-32";
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
