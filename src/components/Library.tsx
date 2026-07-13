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
import type { ItemStatus } from "@/lib/types";
import { AddModal } from "./AddModal";
import { DetailModal } from "./DetailModal";
import { ItemCard } from "./ItemCard";
import { PlusIcon } from "./icons";

type Filter = "all" | ItemStatus;

export default function Library({ section: slug }: { section: SectionSlug }) {
  const section = SECTIONS[slug];
  const { items, ready, loadError, add, update, remove } = useBacklog(
    section.mediaType,
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);
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

  const visible =
    filter === "all" ? items : items.filter((i) => i.status === filter);
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
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          <PlusIcon className="h-4 w-4" />
          Add {section.singular}
        </button>
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
      <DetailModal
        item={selected}
        section={section}
        onClose={() => setSelectedId(null)}
        onUpdate={update}
        onRemove={remove}
      />
    </>
  );
}
