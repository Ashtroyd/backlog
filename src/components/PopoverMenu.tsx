"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useIsClient } from "@/lib/use-is-client";
import { CheckIcon } from "./icons";

export type MenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Shows a checkmark — the current choice in a pull-down. */
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
};

/** Items grouped into sections, drawn with a separator between each. */
export type MenuSections = MenuItem[][];

/** `y` is where the menu hangs from; `flipY` is where it sits above instead
    (the anchor's top edge) when there's no room below. */
type Anchor = {
  x: number;
  y: number;
  flipY: number;
  align: "left" | "right";
  below: number;
};

/**
 * Where a menu opens and whether it is. `openAt` is for context menus (at the
 * pointer); `openFrom` hangs it off a button, like an iOS pull-down.
 */
export function useMenu() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const openAt = useCallback((x: number, y: number) => {
    setAnchor({ x, y, flipY: y, align: "left", below: 0 });
  }, []);
  const openFrom = useCallback(
    (el: HTMLElement, align: "left" | "right" = "right") => {
      const r = el.getBoundingClientRect();
      setAnchor({
        x: align === "right" ? r.right : r.left,
        y: r.bottom,
        flipY: r.top,
        align,
        below: 6,
      });
    },
    [],
  );
  const close = useCallback(() => setAnchor(null), []);
  return { anchor, open: anchor != null, openAt, openFrom, close };
}

const MARGIN = 8;

/**
 * Apple-style menu: a rounded, blurred panel of rows with leading icons,
 * separators between groups, checkmarks for the current choice, and red
 * destructive actions last. Portalled to <body> so no card or dialog clips
 * it; clamped inside the viewport; arrow keys, Home/End and Esc work.
 */
export function PopoverMenu({
  anchor,
  onClose,
  sections,
  label,
  dim = false,
}: {
  anchor: Anchor | null;
  onClose: () => void;
  sections: MenuSections;
  label: string;
  /** Blur the page behind — for touch long-press, as iOS does. */
  dim?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const mounted = useIsClient();

  // Measure after render, then clamp so the whole menu stays on screen.
  useLayoutEffect(() => {
    if (!anchor || !panelRef.current) {
      setPos(null);
      return;
    }
    const { width, height } = panelRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.align === "right" ? anchor.x - width : anchor.x;
    let top = anchor.y + anchor.below;
    if (top + height > vh - MARGIN) {
      const above = anchor.flipY - height - anchor.below;
      // Flip above if it fits there; if neither side fits, take the roomier
      // one and let the clamp below pull it on screen.
      if (above >= MARGIN || anchor.flipY > vh - anchor.y) top = above;
    }
    left = Math.min(Math.max(MARGIN, left), vw - width - MARGIN);
    top = Math.min(Math.max(MARGIN, top), vh - height - MARGIN);
    setPos({ left, top });
  }, [anchor]);

  // Focus the first item on open; close on Esc, scroll or resize.
  useEffect(() => {
    if (!anchor) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = requestAnimationFrame(() =>
      panelRef.current
        ?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')
        ?.focus({ preventScroll: true }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDismiss = () => onClose();
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("scroll", onDismiss, true);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, [anchor, onClose]);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        '[role^="menuitem"]:not([disabled])',
      ) ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "Tab") {
      e.preventDefault();
      onClose();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      items[next]?.focus();
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {anchor && (
        <div key="menu-layer">
          {/* Backdrop at z-60, panel at z-62: a card lifted by long-press
              (z-61) sits between them — above the blur, under the menu. */}
          <motion.div
            className={`fixed inset-0 z-[60] ${dim ? "bg-black/25 backdrop-blur-[6px]" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            onContextMenu={(e) => {
              e.preventDefault();
              onClose();
            }}
          />
          <motion.div
            ref={panelRef}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: pos ? 1 : 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
            style={{
              left: pos?.left ?? anchor.x,
              top: pos?.top ?? anchor.y,
              transformOrigin: anchor.align === "right" ? "top right" : "top left",
            }}
            className="fixed z-[62] w-64 overflow-hidden rounded-[14px] border border-line/60 bg-surface/90 py-1 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl backdrop-saturate-150"
          >
            {sections
              .filter((s) => s.length > 0)
              .map((section, si) => (
                <div
                  key={si}
                  role="group"
                  className={si > 0 ? "mt-1 border-t-[6px] border-line/50 pt-1" : ""}
                >
                  {section.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                      disabled={item.disabled}
                      aria-checked={item.checked}
                      onClick={() => {
                        onClose();
                        item.onSelect();
                      }}
                      className={`flex min-h-11 w-full items-center gap-3 px-4 text-left text-subhead outline-none transition-colors hover:bg-ivory focus-visible:bg-ivory disabled:opacity-40 ${
                        item.destructive ? "text-danger" : "text-ink"
                      }`}
                    >
                      <span className="flex w-4 shrink-0 justify-center text-accent">
                        {item.checked && <CheckIcon className="h-4 w-4" />}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.icon && (
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center ${
                            item.destructive ? "text-danger" : "text-muted"
                          }`}
                        >
                          {item.icon}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
