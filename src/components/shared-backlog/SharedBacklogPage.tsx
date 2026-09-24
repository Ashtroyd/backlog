"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/backlog-store";
import { fetchSharedBacklog, type SharedEntry, type SharedStatus } from "@/lib/shared-backlog";
import { SECTIONS, SECTION_SLUGS, type SectionSlug } from "@/lib/sections";
import { PlusIcon } from "@/components/icons";
import { AddSharedModal } from "./AddSharedModal";
import { SharedItemCard } from "./SharedItemCard";
import { SharedItemDetailModal } from "./SharedItemDetailModal";
import { FriendsTabs } from "../FriendsTabs";

type MediaFilter = "all" | SectionSlug;
type StatusFilter = "all" | SharedStatus;

export default function SharedBacklogPage() {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;

  const [entries, setEntries] = useState<SharedEntry[] | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!myId) return;
    fetchSharedBacklog(myId)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [myId]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<MediaFilter, number> = {
      all: entries?.length ?? 0,
      games: 0,
      movies: 0,
      series: 0,
      anime: 0,
    };
    for (const e of entries ?? []) {
      for (const slug of SECTION_SLUGS) {
        if (SECTIONS[slug].mediaType === e.item.media_type) c[slug]++;
      }
    }
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => {
      if (mediaFilter !== "all" && SECTIONS[mediaFilter].mediaType !== e.item.media_type) {
        return false;
      }
      if (statusFilter !== "all" && e.item.status !== statusFilter) return false;
      return true;
    });
  }, [entries, mediaFilter, statusFilter]);

  const selected = entries?.find((e) => e.item.id === selectedId) ?? null;

  return (
    <>
      <FriendsTabs active="shared" />
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Shared Backlog
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {entries === null
              ? " "
              : entries.length === 0
                ? "Nothing here yet"
                : `${entries.length} title${entries.length === 1 ? "" : "s"} planned with friends`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          <PlusIcon className="h-4 w-4" />
          Add to shared backlog
        </button>
      </header>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {(["all", ...SECTION_SLUGS] as MediaFilter[]).map((f) => {
          const active = mediaFilter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setMediaFilter(f)}
              className={`relative rounded-full px-3.5 py-1.5 text-footnote font-medium transition-colors ${
                active ? "text-paper" : "text-muted hover:bg-ivory hover:text-ink"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="shared-media-pill"
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                />
              )}
              <span className="relative">
                {f === "all" ? "All" : SECTIONS[f].label}{" "}
                <span className={active ? "text-paper/60" : "text-muted"}>{counts[f]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["all", "planned", "completed"] as StatusFilter[]).map((f) => {
          const active = statusFilter === f;
          const label = f === "all" ? "All" : f === "planned" ? "Planned" : "Done together";
          return (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-line-strong bg-ivory text-ink"
                  : "border-line text-muted hover:bg-ivory"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {entries === null ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 pt-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="aspect-[2/3] rounded-xl bg-ivory" />
              <div className="mt-2.5 h-3.5 w-3/4 rounded bg-ivory" />
              <div className="mt-1.5 h-3 w-1/2 rounded bg-ivory" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center py-24 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ivory font-display text-2xl text-accent">
            ✦
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-ink">
            {entries.length === 0 ? "Nothing planned yet" : "Nothing here"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {entries.length === 0
              ? "Pick a title and a friend, and it lands here for both of you to track."
              : "Nothing matches this filter."}
          </p>
          {entries.length === 0 && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-6 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <PlusIcon className="h-4 w-4" />
              Add your first title
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="grid"
          layout
          className="grid grid-cols-2 gap-x-5 gap-y-8 pt-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((entry, i) => (
              <SharedItemCard
                key={entry.item.id}
                entry={entry}
                index={i}
                onClick={() => setSelectedId(entry.item.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AddSharedModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
      <SharedItemDetailModal
        entry={selected}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </>
  );
}
