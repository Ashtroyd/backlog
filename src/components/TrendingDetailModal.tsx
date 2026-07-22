"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/sections";
import type { SearchResult } from "@/lib/types";
import { Modal } from "./Modal";
import { CoverImage } from "./CoverImage";
import { CheckIcon, PlusIcon, SpinnerIcon, XIcon } from "./icons";

type Detail = { id: string; description: string | null; facts: string[] };

/** What a trending title is, before you commit to adding it. */
export function TrendingDetailModal({
  result,
  section,
  alreadyAdded,
  onClose,
  onAdd,
}: {
  result: SearchResult | null;
  section: Section | null;
  alreadyAdded: boolean;
  onClose: () => void;
  onAdd: (r: SearchResult) => Promise<{ error: string | null }>;
}) {
  const [snapshot, setSnapshot] = useState<{ result: SearchResult; section: Section } | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (result && section) {
      setSnapshot({ result, section });
      setAdding(false);
      setNote(null);
    }
  }, [result, section]);

  // Tagged by id, same as the trending list's own load state — a response
  // for a title the user has since navigated away from is just ignored.
  useEffect(() => {
    if (!result || !section) return;
    let alive = true;
    fetch(`/api/trending/detail?type=${section.mediaType}&id=${encodeURIComponent(result.externalId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (alive) {
          setDetail({ id: result.externalId, description: data.detail?.description ?? null, facts: data.detail?.facts ?? [] });
        }
      })
      .catch(() => {
        if (alive) setDetail({ id: result.externalId, description: null, facts: [] });
      });
    return () => {
      alive = false;
    };
  }, [result, section]);

  const current = result && section ? { result, section } : snapshot;
  if (!current) return null;
  const { result: r, section: s } = current;
  const loadedDetail = detail?.id === r.externalId ? detail : null;

  async function handleAdd() {
    setAdding(true);
    setNote(null);
    const { error } = await onAdd(r);
    setAdding(false);
    if (error && error !== "duplicate") setNote(error);
  }

  return (
    <Modal open={Boolean(result)} onClose={onClose} wide>
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-6">
          <div className="relative hidden aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border border-line bg-ivory sm:block">
            <CoverImage src={r.coverUrl} title={r.title} sizes="144px" className="object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-accent">
                  {s.label} · trending
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold leading-snug tracking-tight text-ink">
                  {r.title}
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
              {[r.year, r.genres.join(", ")].filter(Boolean).join(" · ")}
            </p>

            {!loadedDetail && (
              <div className="mt-3 animate-pulse space-y-1.5">
                <div className="h-3 w-full rounded bg-ivory" />
                <div className="h-3 w-full rounded bg-ivory" />
                <div className="h-3 w-2/3 rounded bg-ivory" />
              </div>
            )}

            {loadedDetail?.description && (
              <p className="mt-3 text-sm leading-relaxed text-body">{loadedDetail.description}</p>
            )}

            {loadedDetail?.facts && loadedDetail.facts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {loadedDetail.facts.map((f) => (
                  <span key={f} className="rounded-full bg-ivory px-2.5 py-1 text-xs text-body">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
          {note ? (
            <p className="text-sm text-accent-hover">{note}</p>
          ) : (
            <span className="text-sm text-muted">Adds to your {s.singular} backlog.</span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || alreadyAdded}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-80 ${
              alreadyAdded ? "bg-sage-soft text-sage" : "bg-accent text-white hover:bg-accent-hover"
            }`}
          >
            {alreadyAdded ? (
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
