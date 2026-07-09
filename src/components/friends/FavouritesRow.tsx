"use client";

import { SECTIONS, SECTION_SLUGS } from "@/lib/sections";
import type { BacklogItem } from "@/lib/types";
import { FavouriteCard } from "./FavouriteCard";

/** A person's favourites, one per section, in section order. */
export function FavouritesRow({
  favorites,
  emptyText,
}: {
  favorites: BacklogItem[];
  emptyText?: string;
}) {
  const byMedia = new Map(favorites.map((f) => [f.media_type, f]));
  const present = SECTION_SLUGS.map((slug) =>
    byMedia.get(SECTIONS[slug].mediaType),
  ).filter(Boolean) as BacklogItem[];

  if (present.length === 0) {
    return emptyText ? (
      <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        {emptyText}
      </p>
    ) : null;
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4">
      {present.map((item) => (
        <FavouriteCard key={item.id} item={item} />
      ))}
    </div>
  );
}
