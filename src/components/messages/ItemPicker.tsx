"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchUserItems } from "@/lib/social";
import { sharedItemFrom, type SharedItem } from "@/lib/messages";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import type { BacklogItem } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { SearchIcon, SpinnerIcon } from "@/components/icons";

/** Pick one of your own titles to send as a recommendation card. */
export function ItemPicker({
  open,
  myId,
  onClose,
  onPick,
}: {
  open: boolean;
  myId: string | null;
  onClose: () => void;
  onPick: (item: SharedItem) => void;
}) {
  const [items, setItems] = useState<BacklogItem[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || !myId) return;
    setItems(null);
    setQuery("");
    fetchUserItems(myId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [open, myId]);

  const filtered = (items ?? []).filter((i) =>
    i.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Recommend a title from your library…"
          aria-label="Recommend a title from your library"
          className="w-full bg-transparent text-lg text-ink placeholder:text-muted/70"
        />
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-2">
        {items === null ? (
          <div className="flex justify-center py-10">
            <SpinnerIcon className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">
            {items.length === 0
              ? "Your library is empty — add some titles first."
              : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-line/70">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(sharedItemFrom(item));
                    onClose();
                  }}
                  className="flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-ivory"
                >
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ivory">
                    {item.cover_url && (
                      <Image src={item.cover_url} alt="" fill sizes="44px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {SECTION_BY_MEDIA[item.media_type].label}
                      {item.release_year ? ` · ${item.release_year}` : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
