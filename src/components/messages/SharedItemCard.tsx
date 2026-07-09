"use client";

import Image from "next/image";
import { useState } from "react";
import { addItemToLibrary } from "@/lib/backlog-store";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import type { SharedItem } from "@/lib/messages";
import { CheckIcon, PlusIcon, SpinnerIcon } from "@/components/icons";

/** A recommendation card carried in a message; recipients can add it. */
export function SharedItemCard({
  item,
  mine,
}: {
  item: SharedItem;
  mine: boolean;
}) {
  const section = SECTION_BY_MEDIA[item.media_type];
  const [state, setState] = useState<"idle" | "adding" | "added" | "have">("idle");

  async function add() {
    setState("adding");
    const { error } = await addItemToLibrary({
      mediaType: item.media_type,
      externalId: item.external_id,
      title: item.title,
      coverUrl: item.cover_url,
      releaseYear: item.release_year,
      genres: item.genres,
      meta: {},
    });
    setState(!error ? "added" : error === "duplicate" ? "have" : "idle");
  }

  return (
    <div className="w-64 max-w-full overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex gap-3 p-2.5">
        <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-ivory">
          {item.cover_url && (
            <Image src={item.cover_url} alt="" fill sizes="56px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-accent">
            {section.label}
          </p>
          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
          <p className="truncate text-xs text-muted">
            {[item.release_year, item.genres.slice(0, 2).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {!mine && (
        <button
          type="button"
          onClick={add}
          disabled={state !== "idle"}
          className={`flex w-full items-center justify-center gap-1.5 border-t border-line py-2 text-[13px] font-medium transition-colors ${
            state === "added" || state === "have"
              ? "text-sage"
              : "text-accent hover:bg-accent-soft"
          }`}
        >
          {state === "adding" ? (
            <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
          ) : state === "added" ? (
            <>
              <CheckIcon className="h-3.5 w-3.5" /> Added to backlog
            </>
          ) : state === "have" ? (
            <>
              <CheckIcon className="h-3.5 w-3.5" /> Already in your backlog
            </>
          ) : (
            <>
              <PlusIcon className="h-3.5 w-3.5" /> Add to backlog
            </>
          )}
        </button>
      )}
    </div>
  );
}
