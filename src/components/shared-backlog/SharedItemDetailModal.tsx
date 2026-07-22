"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { SECTION_BY_MEDIA } from "@/lib/sections";
import {
  removeSharedItem,
  updateSharedStatus,
  type SharedEntry,
  type SharedStatus,
} from "@/lib/shared-backlog";
import { Modal } from "@/components/Modal";
import { CoverImage } from "@/components/CoverImage";
import { Avatar } from "@/components/Avatar";
import { useConfirm } from "@/components/ConfirmDialog";
import { CheckIcon, TrashIcon, XIcon } from "@/components/icons";

export function SharedItemDetailModal({
  entry,
  onClose,
  onChanged,
}: {
  entry: SharedEntry | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [snapshot, setSnapshot] = useState<SharedEntry | null>(entry);
  const [status, setStatus] = useState<SharedStatus>("planned");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (entry) {
      setSnapshot(entry);
      setStatus(entry.item.status);
    }
  }, [entry]);

  const current = entry ?? snapshot;

  async function setStatusAndSave(next: SharedStatus) {
    if (!current) return;
    setStatus(next);
    setBusy(true);
    const err = await updateSharedStatus(current.item.id, next);
    setBusy(false);
    if (!err) onChanged();
  }

  async function handleRemove() {
    if (!current) return;
    const ok = await confirm({
      title: `Remove ${current.item.title}?`,
      message: "It comes off the shared backlog with this friend.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const err = await removeSharedItem(current.item.id);
    if (!err) {
      onChanged();
      onClose();
    }
  }

  return (
    <Modal open={Boolean(entry)} onClose={onClose} wide>
      {current && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-6">
            <div className="relative hidden aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border border-line bg-ivory sm:block">
              <CoverImage
                src={current.item.cover_url}
                title={current.item.title}
                sizes="144px"
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-accent">
                    {SECTION_BY_MEDIA[current.item.media_type].label} · shared
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold leading-snug tracking-tight text-ink">
                    {current.item.title}
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
                {[current.item.release_year, current.item.genres.join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div className="mt-4 flex items-center gap-2.5">
                <Link href={`/friends/${current.friend.username}`} onClick={onClose}>
                  <Avatar profile={current.friend} size={30} />
                </Link>
                <p className="text-sm text-body">
                  Planned with{" "}
                  <Link
                    href={`/friends/${current.friend.username}`}
                    onClick={onClose}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {current.friend.display_name}
                  </Link>
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Status
                </p>
                <div className="inline-flex gap-1 rounded-full bg-ivory p-1">
                  {(["planned", "completed"] as SharedStatus[]).map((s) => {
                    const active = status === s;
                    const label =
                      s === "planned"
                        ? "Planned"
                        : current.item.media_type === "game"
                          ? "Played together"
                          : "Watched together";
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => setStatusAndSave(s)}
                        className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                          active ? "text-ink" : "text-muted hover:text-ink"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId={`shared-status-${current.item.id}`}
                            className="absolute inset-0 rounded-full bg-surface shadow-sm"
                            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                          />
                        )}
                        <span className="relative flex items-center gap-1">
                          {s === "completed" && <CheckIcon className="h-3 w-3" />}
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent-hover"
            >
              <TrashIcon className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
