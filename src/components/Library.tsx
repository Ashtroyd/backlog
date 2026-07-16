"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  SECTIONS,
  STATUS_ORDER,
  statusLabel,
  type SectionSlug,
} from "@/lib/sections";
import { useBacklog } from "@/lib/backlog-store";
import type { BacklogItem, ItemStatus } from "@/lib/types";
import { AddModal } from "./AddModal";
import { DetailModal } from "./DetailModal";
import { ImportModal } from "./ImportModal";
import { ItemCard } from "./ItemCard";
import { PlusIcon, SearchIcon, UploadIcon } from "./icons";

/** Sections with a supported bulk-import source (Steam, MyAnimeList, Letterboxd). */
const IMPORTABLE_MEDIA_TYPES = new Set(["game", "anime", "movie"]);

type Filter = "all" | ItemStatus;
type Sort = "added" | "rating" | "title" | "release";

const SORTS: { value: Sort; label: string }[] = [
  { value: "added", label: "Recently added" },
  { value: "rating", label: "Highest rated" },
  { value: "title", label: "Title A–Z" },
  { value: "release", label: "Release year" },
];

function sortItems(list: BacklogItem[], sort: Sort): BacklogItem[] {
  const out = [...list];
  switch (sort) {
    case "rating":
      out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
      break;
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "release":
      out.sort((a, b) => (b.release_year ?? -1) - (a.release_year ?? -1));
      break;
    default:
      break; // "added": server order (created_at desc)
  }
  return out;
}

export default function Library({ section: slug }: { section: SectionSlug }) {
  const section = SECTIONS[slug];
  const { items, ready, loadError, add, bulkAdd, update, remove, applyDetails } =
    useBacklog(section.mediaType);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("added");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: items.length,
      backlog: 0,
      in_progress: 0,
      completed: 0,
      dropped: 0,
    };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  const q = query.trim().toLowerCase();
  const visible = sortItems(
    items
      .filter((i) => filter === "all" || i.status === filter)
      .filter((i) => !q || i.title.toLowerCase().includes(q)),
    sort,
  );
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const filters: Filter[] = ["all", ...STATUS_ORDER];

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 pt-12">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
            {section.label}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {!ready
              ? " "
              : items.length === 0
                ? "Nothing here yet"
                : `${items.length} title${items.length === 1 ? "" : "s"} · ${counts.completed} completed`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {IMPORTABLE_MEDIA_TYPES.has(section.mediaType) && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-ivory"
            >
              <UploadIcon className="h-4 w-4" />
              Import
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <PlusIcon className="h-4 w-4" />
            Add {section.singular}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="mt-6 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-hover">
          {loadError}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active ? "text-paper" : "text-muted hover:bg-ivory hover:text-ink"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`filter-pill-${slug}`}
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                />
              )}
              <span className="relative">
                {f === "all" ? "All" : statusLabel(f, section)}{" "}
                <span className={active ? "text-paper/60" : "text-muted/60"}>
                  {counts[f]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 sm:max-w-xs">
            <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search your ${section.label.toLowerCase()}…`}
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort by"
            className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-body focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!ready ? (
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
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ivory font-serif text-2xl text-accent">
            ✦
          </div>
          <h2 className="mt-5 font-serif text-xl font-semibold text-ink">
            {items.length === 0 ? section.emptyTitle : "Nothing here"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {items.length === 0
              ? section.emptyBody
              : q
                ? `Nothing matches “${query.trim()}”.`
                : "No titles with this status yet."}
          </p>
          {items.length === 0 && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-6 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <PlusIcon className="h-4 w-4" />
              Add your first {section.singular}
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
            {visible.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                section={section}
                index={i}
                onClick={() => setSelectedId(item.id)}
                onUpdate={update}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        section={section}
        existingIds={new Set(items.map((i) => i.external_id))}
        onAdd={add}
      />
      {IMPORTABLE_MEDIA_TYPES.has(section.mediaType) && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          section={section}
          existingIds={new Set(items.map((i) => i.external_id))}
          bulkAdd={bulkAdd}
        />
      )}
      <DetailModal
        item={selected}
        section={section}
        onClose={() => setSelectedId(null)}
        onUpdate={update}
        onRemove={remove}
        onRefresh={applyDetails}
      />
    </>
  );
}
