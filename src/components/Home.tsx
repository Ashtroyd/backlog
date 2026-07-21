"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAllMyItems, fetchRecentReviews, useAuth } from "@/lib/backlog-store";
import { fetchConnections, fetchRecommendations, type Recommendation } from "@/lib/social";
import { currentMonth, fetchTopPicks, monthLabel, type TopPick } from "@/lib/top-picks";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import type { BacklogItem } from "@/lib/types";
import { CoverImage } from "./CoverImage";
import { StarRating } from "./StarRating";
import { RecommendationModal } from "./friends/RecommendationModal";
import { TopPicksPicker } from "./TopPicksPicker";
import { PlusIcon } from "./icons";

/**
 * The app's landing page: a few quiet, high-signal shelves rather than a
 * dashboard — recent reviews, what friends are loving, and a personal
 * highlight reel the user curates each month.
 */
export default function Home() {
  const { session, profile } = useAuth();
  const myId = session?.user?.id ?? null;
  const month = currentMonth();

  const [reviews, setReviews] = useState<BacklogItem[] | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [openRec, setOpenRec] = useState<Recommendation | null>(null);
  const [picks, setPicks] = useState<TopPick[] | null>(null);
  const [allItems, setAllItems] = useState<BacklogItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadPicks = useCallback(async () => {
    if (!myId) return;
    setPicks(await fetchTopPicks(myId, month));
  }, [myId, month]);

  useEffect(() => {
    if (!myId) return;
    fetchRecentReviews(myId).then(setReviews);
    fetchConnections(myId).then((c) => fetchRecommendations(myId, c.friends).then(setRecs));
    loadPicks();
  }, [myId, loadPicks]);

  function openPicker() {
    if (!myId) return;
    fetchAllMyItems(myId).then(setAllItems);
    setPickerOpen(true);
  }

  if (!profile) return null;

  return (
    <div className="pt-12 pb-4">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">
        Welcome back, {profile.display_name.split(" ")[0]}
      </h1>

      {reviews && reviews.length > 0 && (
        <HomeSection title="Recent reviews">
          <Shelf>
            {reviews.map((item) => (
              <ShelfCard
                key={item.id}
                href={`/${SECTION_BY_MEDIA[item.media_type].slug}`}
                coverUrl={item.cover_url}
                title={item.title}
                ratingValue={item.rating}
                subtitle={<span className="italic">{item.review ?? item.current_thoughts}</span>}
              />
            ))}
          </Shelf>
        </HomeSection>
      )}

      {recs && recs.length > 0 && (
        <HomeSection
          title="From your friends"
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
      )}

      <HomeSection
        title={`Top picks · ${monthLabel(month)}`}
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
                href={`/${SECTION_BY_MEDIA[p.item.media_type].slug}`}
                coverUrl={p.item.cover_url}
                title={p.item.title}
                ratingValue={p.item.rating}
                subtitle={SECTION_BY_MEDIA[p.item.media_type].label}
              />
            ))}
          </Shelf>
        )}
      </HomeSection>

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
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Shelf({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-4 overflow-x-auto pb-2">{children}</div>;
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
