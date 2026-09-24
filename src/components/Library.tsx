"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  SECTIONS,
  SECTION_SLUGS,
  STATUS_ORDER,
  statusLabel,
  type SectionSlug,
} from "@/lib/sections";
import { useBacklog } from "@/lib/backlog-store";
import type { BacklogItem, ItemStatus } from "@/lib/types";
import { AddModal } from "./AddModal";
import { DetailModal } from "./DetailModal";
import { ImportModal } from "./ImportModal";
import { importExclusion } from "@/lib/import-cleanup";
import { toast } from "@/lib/toast-bus";
import { ItemCard } from "./ItemCard";
import { SegmentedNav } from "./SegmentedNav";
import { rememberSection } from "@/lib/last-section";
import { PinIcon, PlusIcon, SearchIcon, UploadIcon } from "./icons";

/** Sections with a supported bulk-import source (Steam, MyAnimeList, Letterboxd). */
const IMPORTABLE_MEDIA_TYPES = new Set(["game", "anime", "movie", "series"]);

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

export default function Library({
  section: slug,
  initialItemId,
}: {
  section: SectionSlug;
  initialItemId?: string;
}) {
  const section = SECTIONS[slug];
  // The Library tab reopens whichever type you last had open.
  useEffect(() => rememberSection(slug), [slug]);
  const router = useRouter();
  const pathname = usePathname();
  const {
    items,
    ready,
    loadError,
    add,
    bulkAdd,
    update,
    remove,
    applyDetails,
  } = useBacklog(section.mediaType);
  const params = useSearchParams();
  const rawFilter = params.get("status") ?? "all";
  const filter: Filter = STATUS_ORDER.includes(rawFilter as ItemStatus)
    ? (rawFilter as ItemStatus)
    : "all";
  const query = params.get("q") ?? "";
  const rawSort = params.get("sort");
  const sort: Sort = SORTS.some((s) => s.value === rawSort)
    ? (rawSort as Sort)
    : "added";
  const view = params.get("view") === "list" ? "list" : "grid";
  const scope = params.get("scope") ?? "all";
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ItemStatus>("backlog");
  const [bulkBusy, setBulkBusy] = useState(false);

  function setParam(key: string, value: string, defaultValue = "") {
    const next = new URLSearchParams(window.location.search);
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    window.history.replaceState(
      null,
      "",
      `${pathname}${next.size ? `?${next}` : ""}`,
    );
    setChecked(new Set());
  }
  const setFilter = (value: Filter) => setParam("status", value, "all");
  const setQuery = (value: string) => setParam("q", value);
  const setSort = (value: Sort) => setParam("sort", value, "added");

  function toggleItem(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkStatus() {
    if (bulkBusy || !checked.size) return;
    setBulkBusy(true);
    let saved = 0;
    const failed = new Set<string>();
    for (const id of checked) {
      try {
        const result = await update(id, { status: bulkStatus });
        if (result.error) failed.add(id);
        else saved++;
      } catch {
        failed.add(id);
      }
    }
    setChecked(failed);
    setBulkBusy(false);
    toast(
      failed.size ? "error" : "success",
      failed.size
        ? `${saved} updated; ${failed.size} couldn't save. Retry the selected titles.`
        : `Updated ${saved} titles.`,
    );
  }
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItemId ?? null,
  );

  function closeDetail() {
    setSelectedId(null);
    if (initialItemId) {
      const next = new URLSearchParams(window.location.search);
      next.delete("item");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
        scroll: false,
      });
    }
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: items.length,
      backlog: 0,
      in_progress: 0,
      completed: 0,
      dropped: 0,
      on_hold: 0,
    };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  const q = query.trim().toLowerCase();
  const visible = sortItems(
    items
      .filter((i) => filter === "all" || i.status === filter)
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .filter((i) =>
        scope === "favourites"
          ? i.is_favorite
          : section.mediaType !== "game"
            ? true
            : scope === "active"
              ? i.status === "in_progress" && !i.live_service
              : scope === "live"
                ? i.live_service
                : scope === "cleanup"
                  ? importExclusion(i.title) != null
                  : true,
      ),
    sort,
  );
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const filters: Filter[] = ["all", ...STATUS_ORDER];

  const pinned = useMemo(
    () =>
      items
        .filter((i) => i.pinned_at != null)
        .sort((a, b) =>
          (b.pinned_at as string).localeCompare(a.pinned_at as string),
        ),
    [items],
  );

  return (
    <>
      <div className="pt-10 sm:pt-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink">
          Library
        </h1>
        <div className="mt-4">
          <SegmentedNav
            id="library"
            label="Library type"
            segments={SECTION_SLUGS.map((s) => ({
              href: `/${s}`,
              label: SECTIONS[s].label,
              active: s === slug,
            }))}
          />
        </div>
      </div>
      <header className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="sr-only">{section.label}</h2>
          <p className="text-sm text-muted">
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
              data-tour="import-button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-ivory"
            >
              <UploadIcon className="h-4 w-4" />
              Import
            </button>
          )}
          <button
            type="button"
            data-tour="add-button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <PlusIcon className="h-4 w-4" />
            Add {section.singular}
          </button>
        </div>
      </header>

      {pinned.length > 0 && (
        <div className="mt-7">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <PinIcon className="h-3.5 w-3.5" />
            Up next
          </h2>
          <div className="shelf-scrollbar flex snap-x snap-proximity gap-4 overflow-x-auto pb-2">
            {pinned.map((item, i) => (
              <div key={item.id} className="w-28 shrink-0 snap-start sm:w-32">
                <ItemCard
                  item={item}
                  section={section}
                  index={i}
                  onClick={() => setSelectedId(item.id)}
                  onUpdate={update}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {loadError && (
        <div className="mt-6 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-hover">
          {loadError}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1.5" data-tour="filter-tabs">
        {filters.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              disabled={bulkBusy}
              className={`relative rounded-full px-3.5 py-1.5 text-footnote font-medium transition-colors ${
                active
                  ? "text-paper"
                  : "text-muted hover:bg-ivory hover:text-ink"
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
                <span className={active ? "text-paper/60" : "text-muted"}>
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
              disabled={bulkBusy}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search your ${section.label.toLowerCase()}…`}
              aria-label={`Search your ${section.label.toLowerCase()}`}
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted/70"
            />
          </div>
          <select
            value={sort}
            disabled={bulkBusy}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort by"
            className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-body"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Library filter"
            value={scope}
            disabled={bulkBusy}
            onChange={(e) => setParam("scope", e.target.value, "all")}
            className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-body"
          >
            <option value="all">All titles</option>
            <option value="favourites">Favourites</option>
            {section.mediaType === "game" && (
              <>
                <option value="active">Playing · excluding live service</option>
                <option value="live">Live service</option>
                <option value="cleanup">Playtests & utilities</option>
              </>
            )}
          </select>
          <div
            className="flex rounded-full border border-line p-1"
            aria-label="Library view"
          >
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                disabled={bulkBusy}
                onClick={() => setParam("view", v, "grid")}
                className={`rounded-full px-3 py-1 text-sm capitalize ${view === v ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={bulkBusy}
            aria-pressed={selecting}
            onClick={() => {
              setSelecting(!selecting);
              setChecked(new Set());
            }}
            className="rounded-full border border-line px-3.5 py-2 text-sm text-ink hover:bg-ivory"
          >
            {selecting ? "Done selecting" : "Select titles"}
          </button>
        </div>
      )}
      {selecting && (
        <fieldset
          disabled={bulkBusy}
          className="sticky top-16 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm"
        >
          <button
            type="button"
            onClick={() =>
              setChecked(
                visible.every((i) => checked.has(i.id))
                  ? new Set()
                  : new Set(visible.map((i) => i.id)),
              )
            }
            className="text-sm text-accent hover:text-accent-hover"
          >
            {visible.length > 0 && visible.every((i) => checked.has(i.id))
              ? "Deselect all"
              : "Select visible"}
          </button>
          <span aria-live="polite" className="text-sm text-muted">
            {checked.size} selected
          </span>
          <select
            aria-label="Status for selected titles"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as ItemStatus)}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status, section)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkStatus}
            disabled={!checked.size || bulkBusy}
            className="rounded-full bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {bulkBusy ? "Updating…" : "Apply status"}
          </button>
        </fieldset>
      )}

      {!ready ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 pt-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            >
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
            {items.length === 0 ? section.emptyTitle : "Nothing here"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {items.length === 0
              ? section.emptyBody
              : q
                ? `Nothing matches “${query.trim()}”.`
                : "No titles with this status yet."}
          </p>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                window.history.replaceState(null, "", pathname);
                setChecked(new Set());
              }}
              className="mt-4 rounded-full border border-line px-4 py-2 text-sm text-ink hover:bg-ivory"
            >
              Clear filters
            </button>
          )}
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
      ) : view === "list" ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-ivory text-muted">
              <tr>
                <th className="p-3">Title</th>
                <th className="p-3">Status</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((item) => (
                <tr key={item.id} className="bg-surface hover:bg-ivory/50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {selecting && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.title}`}
                          checked={checked.has(item.id)}
                          disabled={bulkBusy}
                          onChange={() => toggleItem(item.id)}
                          className="h-5 w-5 accent-accent"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="text-left font-medium text-ink hover:text-accent"
                      >
                        {item.title}
                      </button>
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-3 text-muted">
                    {item.live_service && item.status === "in_progress"
                      ? "Live service"
                      : statusLabel(item.status, section)}
                  </td>
                  <td className="whitespace-nowrap p-3 tabular-nums text-muted">
                    {item.progress != null
                      ? `${item.progress} episodes`
                      : item.hours_played != null
                        ? `${item.hours_played} hrs`
                        : "—"}
                  </td>
                  <td className="p-3 tabular-nums text-muted">
                    {item.rating != null ? `${item.rating}/5` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <motion.div
          key="grid"
          layout
          className="grid grid-cols-2 gap-x-5 gap-y-8 pt-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((item, i) => (
              <div key={item.id} className="min-w-0">
                {selecting && (
                  <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={checked.has(item.id)}
                      disabled={bulkBusy}
                      onChange={() => toggleItem(item.id)}
                      aria-label={`Select ${item.title}`}
                      className="h-5 w-5 accent-accent"
                    />{" "}
                    Select
                  </label>
                )}
                <ItemCard
                  item={item}
                  section={section}
                  index={i}
                  onClick={() =>
                    selecting ? toggleItem(item.id) : setSelectedId(item.id)
                  }
                  onUpdate={selecting ? undefined : update}
                  dataTour={i === 0 ? "item-card" : undefined}
                />
              </div>
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
          existingTitles={items.map((i) => i.title)}
          bulkAdd={bulkAdd}
        />
      )}
      <DetailModal
        item={selected}
        section={section}
        onClose={closeDetail}
        onUpdate={update}
        onRemove={remove}
        onRefresh={applyDetails}
      />
    </>
  );
}
