"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  SECTIONS,
  SECTION_BY_MEDIA,
  SECTION_SLUGS,
  type SectionSlug,
} from "@/lib/sections";
import type { BacklogItem, Profile } from "@/lib/types";
import { ItemCard } from "@/components/ItemCard";
import { FriendItemModal } from "./FriendItemModal";

/** Read-only browse of a friend's library, grouped by section. */
export function FriendLibrary({
  items,
  profile,
  myItemsByKey,
}: {
  items: BacklogItem[];
  profile: Profile;
  myItemsByKey: Map<string, BacklogItem>;
}) {
  // Only show sections the friend actually has entries in.
  const counts = useMemo(() => {
    const c = {} as Record<SectionSlug, number>;
    SECTION_SLUGS.forEach((s) => (c[s] = 0));
    for (const it of items) c[SECTION_BY_MEDIA[it.media_type].slug]++;
    return c;
  }, [items]);

  const available = SECTION_SLUGS.filter((s) => counts[s] > 0);
  const [active, setActive] = useState<SectionSlug>(available[0] ?? "games");
  const [openId, setOpenId] = useState<string | null>(null);

  // items arrives as [] on the first render (the parent fetches it
  // async), so `available` is empty then and the state initializer above
  // locks onto the "games" fallback — jump to wherever the data actually
  // showed up once it does, instead of leaving the tab stuck on an empty
  // section.
  const availableKey = available.join(",");
  useEffect(() => {
    if (available.length > 0 && !available.includes(active)) {
      setActive(available[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey]);

  const visible = items.filter(
    (i) => SECTIONS[active].mediaType === i.media_type,
  );
  const selected = items.find((i) => i.id === openId) ?? null;
  const mineForSelected = selected
    ? myItemsByKey.get(`${selected.media_type}:${selected.external_id}`) ?? null
    : null;

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        {profile.display_name} hasn&apos;t added anything visible to you yet.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {available.map((s) => {
          const isActive = active === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                isActive ? "text-paper" : "text-muted hover:bg-ivory hover:text-ink"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="friend-lib-pill"
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                />
              )}
              <span className="relative">
                {SECTIONS[s].label}{" "}
                <span className={isActive ? "text-paper/60" : "text-muted/60"}>
                  {counts[s]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <motion.div
        layout
        className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((item, i) => (
            <ItemCard
              key={item.id}
              item={item}
              section={SECTIONS[active]}
              index={i}
              onClick={() => setOpenId(item.id)}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      <FriendItemModal
        item={selected}
        profile={profile}
        mine={mineForSelected}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
