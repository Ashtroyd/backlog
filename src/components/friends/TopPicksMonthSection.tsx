"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import { currentMonth, fetchTopPicks, monthLabel, type TopPick } from "@/lib/top-picks";
import type { BacklogItem, Profile } from "@/lib/types";
import { FriendItemModal } from "./FriendItemModal";

type FriendContext = { profile: Profile; myItemsByKey: Map<string, BacklogItem> };

/** A user's curated top picks, browsable month by month. Pass `friend` when
    viewing someone else's — cards then open a read-only modal instead of
    navigating to your own section page. */
export function TopPicksMonthSection({
  userId,
  friend,
}: {
  userId: string;
  friend?: FriendContext;
}) {
  const [month, setMonth] = useState(currentMonth());
  const [picks, setPicks] = useState<TopPick[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPicks(null);
    fetchTopPicks(userId, month).then((p) => alive && setPicks(p));
    return () => {
      alive = false;
    };
  }, [userId, month]);

  const selected = picks?.find((p) => p.item.id === openId)?.item ?? null;
  const mineForSelected =
    friend && selected
      ? friend.myItemsByKey.get(`${selected.media_type}:${selected.external_id}`) ?? null
      : null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-ink">Top picks</h2>
        <input
          type="month"
          value={month}
          max={currentMonth()}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Choose month"
          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-body"
        />
      </div>

      {picks == null ? null : picks.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
          No picks chosen for {monthLabel(month)}.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-5">
          {picks.map((p) => (
            <TopPickCard
              key={p.id}
              item={p.item}
              onClick={friend ? () => setOpenId(p.item.id) : undefined}
            />
          ))}
        </div>
      )}

      {friend && (
        <FriendItemModal
          item={selected}
          profile={friend.profile}
          mine={mineForSelected}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}

function TopPickCard({ item, onClick }: { item: BacklogItem; onClick?: () => void }) {
  const section = SECTION_BY_MEDIA[item.media_type];
  const content = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-ivory shadow-[0_1px_2px_rgba(38,37,33,0.06)]">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, 180px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-4xl text-line-strong">
            {item.title.charAt(0)}
          </div>
        )}
      </div>
      <p className="mt-2 truncate px-0.5 text-sm font-medium text-ink">{item.title}</p>
      <p className="truncate px-0.5 text-xs text-muted">{section.label}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  ) : (
    <Link href={`/${section.slug}`} className="block text-left">
      {content}
    </Link>
  );
}
