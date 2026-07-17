"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { addItemToLibrary } from "@/lib/backlog-store";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import { itemChips } from "@/lib/chips";
import type { Recommendation } from "@/lib/social";
import { Modal } from "@/components/Modal";
import { StarRating } from "@/components/StarRating";
import { Avatar } from "@/components/Avatar";
import { CheckIcon, PlusIcon, SpinnerIcon, XIcon } from "@/components/icons";

/**
 * A friend recommendation: shows what the title is, who rates it highly, and
 * lets you drop it straight into your own backlog.
 */
export function RecommendationModal({
  rec,
  onClose,
  onAdded,
}: {
  rec: Recommendation | null;
  onClose: () => void;
  onAdded: (key: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<Recommendation | null>(rec);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (rec) {
      setSnapshot(rec);
      setAdding(false);
      setDone(false);
      setNote(null);
    }
  }, [rec]);

  const current = rec ?? snapshot;
  if (!current) return null;

  const { item } = current;
  const section = SECTION_BY_MEDIA[item.media_type];
  const chips = itemChips(item);
  const key = `${item.media_type}:${item.external_id}`;

  async function handleAdd() {
    setAdding(true);
    setNote(null);
    const { error } = await addItemToLibrary({
      mediaType: item.media_type,
      externalId: item.external_id,
      title: item.title,
      coverUrl: item.cover_url,
      releaseYear: item.release_year,
      genres: item.genres,
      meta: item.meta,
    });
    setAdding(false);
    if (!error || error === "duplicate") {
      setDone(true);
      setTimeout(() => onAdded(key), 700);
    } else {
      setNote(error);
    }
  }

  return (
    <Modal open={Boolean(rec)} onClose={onClose} wide>
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-6">
          <div className="relative hidden aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border border-line bg-ivory sm:block">
            {item.cover_url && (
              <Image src={item.cover_url} alt="" fill sizes="144px" className="object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-accent">
                  {section.label} · recommended
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold leading-snug tracking-tight text-ink">
                  {item.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1 text-sm text-muted">
              {[item.release_year, item.genres.join(", ")].filter(Boolean).join(" · ")}
            </p>

            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="rounded-full bg-ivory px-2.5 py-1 text-xs text-body">
                    {c}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Recommended by
              </p>
              <ul className="space-y-2">
                {current.raters.map((r) => (
                  <li key={r.profile.id} className="flex items-center gap-2.5">
                    {/* Hidden from assistive tech — the name link right
                        after repeats the same destination with a real
                        accessible name. */}
                    <Link
                      href={`/friends/${r.profile.username}`}
                      onClick={onClose}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      <Avatar profile={r.profile} size={30} />
                    </Link>
                    <Link
                      href={`/friends/${r.profile.username}`}
                      onClick={onClose}
                      className="text-sm font-medium text-ink hover:text-accent"
                    >
                      {r.profile.display_name}
                    </Link>
                    {r.rating != null && <StarRating value={r.rating} size={13} />}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
          {note ? (
            <p className="text-sm text-accent-hover">{note}</p>
          ) : (
            <span className="text-sm text-muted">
              Adds to your {section.singular} backlog.
            </span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || done}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-80 ${
              done
                ? "bg-sage-soft text-sage"
                : "bg-accent text-white hover:bg-accent-hover"
            }`}
          >
            {done ? (
              <>
                <CheckIcon className="h-4 w-4" /> Added
              </>
            ) : adding ? (
              <>
                <SpinnerIcon className="h-4 w-4 animate-spin" /> Adding…
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4" /> Add to backlog
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
