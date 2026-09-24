"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openCommandPalette } from "@/lib/command-palette-bus";
import { readLastSection } from "@/lib/last-section";
import { onShortcutsOpen, requestAddTitle } from "@/lib/shortcut-bus";
import { Modal } from "./Modal";
import { XIcon } from "./icons";

/** Each entry lists alternative key combos; each combo is a key sequence. */
const SHORTCUTS: { combos: string[][]; label: string }[] = [
  { combos: [["⌘", "K"], ["/"]], label: "Search and add" },
  { combos: [["N"]], label: "Add a title to this section" },
  { combos: [["1"]], label: "Up Next" },
  { combos: [["2"]], label: "Library" },
  { combos: [["3"]], label: "Friends" },
  { combos: [["Esc"]], label: "Close a sheet or menu" },
  { combos: [["?"]], label: "Show these shortcuts" },
];

/** True when a key press belongs to a text field, not to us. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Single-key shortcuts for a keyboard (the Mac app convention of ⌘N isn't
 * available — browsers keep it for a new window): / search, N add, 1–3 to
 * switch tabs, ? for this list. Ignored while typing or with a sheet open.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => onShortcutsOpen(() => setOpen(true)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTyping(e.target)) return;
      // A sheet, dialog or menu is up: leave its keys alone.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      const go = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      switch (e.key) {
        case "/":
          return go(openCommandPalette);
        case "n":
        case "N":
          return go(() => {
            if (!requestAddTitle()) openCommandPalette();
          });
        case "1":
          return go(() => router.push("/"));
        case "2":
          return go(() => router.push(`/${readLastSection()}`));
        case "3":
          return go(() => router.push("/friends"));
        case "?":
          return go(() => setOpen(true));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} sheet>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Done"
            className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-xl bg-ivory/60">
          {SHORTCUTS.map(({ combos, label }) => (
            <li
              key={label}
              className="flex min-h-11 items-center justify-between gap-4 px-4 text-subhead text-ink"
            >
              {label}
              <span className="flex items-center gap-1">
                {combos.map((keys, i) => (
                  <Fragment key={keys.join("+")}>
                    {i > 0 && <span className="px-1 text-footnote text-muted">or</span>}
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="min-w-7 rounded-md border border-line bg-surface px-1.5 py-0.5 text-center font-sans text-footnote text-muted shadow-[0_1px_0_var(--line)]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
