"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { Modal } from "./Modal";
import { GripIcon } from "./icons";

/** iOS-style switch. */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-[#34c759]" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-[left] duration-200 ${
          checked ? "left-[22px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

function Row<K extends string>({
  value,
  label,
  shown,
  onToggle,
}: {
  value: K;
  label: string;
  shown: boolean;
  onToggle: (v: boolean) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      className="flex min-h-12 items-center gap-3 bg-ivory/70 px-4"
    >
      <span className={`flex-1 text-subhead ${shown ? "text-ink" : "text-muted"}`}>
        {label}
      </span>
      <Switch checked={shown} onChange={onToggle} label={`Show ${label}`} />
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        onPointerDown={(e) => controls.start(e)}
        style={{ touchAction: "none" }}
        className="-mr-2 flex h-11 w-9 cursor-grab items-center justify-center text-muted active:cursor-grabbing"
      >
        <GripIcon className="h-5 w-5" />
      </button>
    </Reorder.Item>
  );
}

/**
 * Arrange Up Next, like editing the Safari start page: drag ≡ to reorder,
 * switch shelves on or off, then Done. Replaces the always-visible grip
 * handles that used to sit on every shelf title.
 */
export function EditUpNextSheet<K extends string>({
  open,
  order,
  hidden,
  labels,
  onClose,
  onSave,
}: {
  open: boolean;
  order: K[];
  hidden: Set<K>;
  labels: Record<K, string>;
  onClose: () => void;
  onSave: (order: K[], hidden: Set<K>) => void;
}) {
  // Each edit starts from the saved layout: the parent re-keys this sheet
  // every time it opens, so these initialisers run fresh.
  const [draftOrder, setDraftOrder] = useState(order);
  const [draftHidden, setDraftHidden] = useState(() => new Set(hidden));

  function toggle(key: K, shown: boolean) {
    setDraftHidden((prev) => {
      const next = new Set(prev);
      if (shown) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Modal open={open} onClose={onClose} sheet>
      <div className="flex items-center justify-between px-4 pb-2 pt-6 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="-ml-2 min-h-11 rounded-lg px-2 text-subhead text-accent"
        >
          Cancel
        </button>
        <h2 className="text-subhead font-semibold text-ink">Edit Up Next</h2>
        <button
          type="button"
          onClick={() => {
            onSave(draftOrder, draftHidden);
            onClose();
          }}
          className="-mr-2 min-h-11 rounded-lg px-2 text-subhead font-semibold text-accent"
        >
          Done
        </button>
      </div>
      <div className="px-4 pb-6 sm:px-6">
        <p className="mb-2 mt-3 px-4 text-footnote text-muted">
          Drag to reorder. Switch off anything you don&apos;t need.
        </p>
        <Reorder.Group
          axis="y"
          values={draftOrder}
          onReorder={setDraftOrder}
          className="divide-y divide-line overflow-hidden rounded-xl"
        >
          {draftOrder.map((key) => (
            <Row
              key={key}
              value={key}
              label={labels[key]}
              shown={!draftHidden.has(key)}
              onToggle={(v) => toggle(key, v)}
            />
          ))}
        </Reorder.Group>
        <p className="mt-2 px-4 text-footnote text-muted">
          Shelves with nothing in them stay out of the way until they do.
        </p>
      </div>
    </Modal>
  );
}
