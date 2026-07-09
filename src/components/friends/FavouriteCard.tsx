"use client";

import Image from "next/image";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import type { BacklogItem } from "@/lib/types";
import { HeartIcon } from "@/components/icons";

/** A single favourite: cover with a heart badge and the section label. */
export function FavouriteCard({ item }: { item: BacklogItem }) {
  const section = SECTION_BY_MEDIA[item.media_type];
  return (
    <div className="text-left">
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
        <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 text-accent shadow-sm backdrop-blur">
          <HeartIcon className="h-4 w-4" fill="currentColor" />
        </span>
      </div>
      <p className="mt-2 truncate px-0.5 text-sm font-medium text-ink">
        {item.title}
      </p>
      <p className="truncate px-0.5 text-xs text-muted">
        Favourite {section.singular}
      </p>
    </div>
  );
}
