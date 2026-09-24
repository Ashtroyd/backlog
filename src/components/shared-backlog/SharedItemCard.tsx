"use client";

import { motion } from "motion/react";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import type { SharedEntry } from "@/lib/shared-backlog";
import { CoverImage } from "@/components/CoverImage";
import { Avatar } from "@/components/Avatar";

export function SharedItemCard({
  entry,
  index,
  onClick,
}: {
  entry: SharedEntry;
  index: number;
  onClick: () => void;
}) {
  const { item, friend } = entry;
  const section = SECTION_BY_MEDIA[item.media_type];
  const doneLabel = item.media_type === "game" ? "Played together" : "Watched together";

  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.04, 0.3),
      }}
      whileHover={{ y: -4 }}
      className="group cursor-pointer text-left"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-ivory shadow-[0_1px_2px_rgba(38,37,33,0.06)] transition-shadow duration-300 group-hover:shadow-[0_12px_28px_rgba(38,37,33,0.14)]">
        <CoverImage
          src={item.cover_url}
          title={item.title}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
        />
        <span className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-paper/90 py-0.5 pl-0.5 pr-2 text-caption2 font-semibold text-ink shadow-sm backdrop-blur">
          <Avatar profile={friend} size={16} />
          <span className="truncate">{friend.display_name}</span>
        </span>
        {item.status === "completed" && (
          <span className="absolute right-2 top-2 rounded-full bg-sage px-2 py-0.5 text-caption2 font-semibold text-white shadow-sm">
            {doneLabel}
          </span>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {section.label}
          {item.release_year ? ` · ${item.release_year}` : ""}
        </p>
      </div>
    </motion.div>
  );
}
