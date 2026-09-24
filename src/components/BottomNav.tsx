"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { openCommandPalette } from "@/lib/command-palette-bus";
import { activeTab, useLibraryHref, type TabKey } from "@/lib/last-section";
import { useUnread } from "@/lib/nav-context";
import { LibraryIcon, SearchIcon, UpNextIcon, UsersIcon } from "./icons";

type Rect = { left: number; width: number };

/**
 * Mobile-only floating glass capsule tab bar — Up Next, Library, Friends —
 * with Search as its own glass circle beside it, as in iOS 26. Supports iOS-style
 * press-and-hold-and-drag: touch down anywhere on the bar and a glass
 * pill tracks your finger, snapping between tabs, and lifts to navigate
 * wherever it lands — a normal tap still navigates instantly.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const libraryHref = useLibraryHref();
  const unread = useUnread();
  const current = activeTab(pathname);
  const ITEMS: { key: TabKey; href: string; label: string; Icon: typeof UpNextIcon; badge?: number }[] = [
    { key: "upnext", href: "/", label: "Up Next", Icon: UpNextIcon },
    { key: "library", href: libraryHref, label: "Library", Icon: LibraryIcon },
    { key: "friends", href: "/friends", label: "Friends", Icon: UsersIcon, badge: unread },
  ];
  const isActive = (href: string) =>
    ITEMS.find((i) => i.href === href)?.key === current;

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const draggingRef = useRef(false);
  // Mirrors dragHref synchronously so endDrag reads the live value even
  // when pointerup lands in the same batch as the last pointermove.
  const dragHrefRef = useRef<string | null>(null);

  const [dragHref, setDragHref] = useState<string | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);

  function rectFor(href: string): Rect | null {
    const el = itemRefs.current.get(href);
    const container = containerRef.current;
    if (!el || !container) return null;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return { left: elRect.left - containerRect.left, width: elRect.width };
  }

  function hrefAtX(clientX: number): string | null {
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const item of ITEMS) {
      const el = itemRefs.current.get(item.href);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const dist = Math.abs(clientX - (r.left + r.width / 2));
      if (dist < closestDist) {
        closestDist = dist;
        closest = item.href;
      }
    }
    return closest;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLAnchorElement>, href: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    dragHrefRef.current = href;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragHref(href);
    setDragRect(rectFor(href));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const href = hrefAtX(e.clientX);
    if (href && href !== dragHrefRef.current) {
      dragHrefRef.current = href;
      setDragHref(href);
      setDragRect(rectFor(href));
    }
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const landed = dragHrefRef.current;
    dragHrefRef.current = null;
    if (landed && landed !== pathname) router.push(landed);
    setDragRect(null);
    setDragHref(null);
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 z-30 mx-auto flex max-w-sm items-center gap-2.5 sm:hidden"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div
        ref={containerRef}
        className="relative flex flex-1 touch-none items-stretch justify-around rounded-full border border-line/70 bg-surface/75 px-1.5 py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150"
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <AnimatePresence>
          {dragRect && (
            <motion.div
              className="pointer-events-none absolute inset-y-1.5 rounded-full bg-ivory/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_10px_rgba(0,0,0,0.18)] backdrop-blur-md"
              initial={{ opacity: 0, left: dragRect.left, width: dragRect.width }}
              animate={{ opacity: 1, left: dragRect.left, width: dragRect.width }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            />
          )}
        </AnimatePresence>

        {ITEMS.map(({ href, label, Icon, badge }) => (
          <a
            key={href}
            ref={(el) => {
              if (el) itemRefs.current.set(href, el);
            }}
            href={href}
            aria-label={badge ? `${label}, ${badge} unread` : label}
            aria-current={isActive(href) ? "page" : undefined}
            onPointerDown={(e) => handlePointerDown(e, href)}
            onClick={(e) => {
              e.preventDefault();
              if (href !== pathname) router.push(href);
            }}
            className={`relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 text-caption2 font-medium transition-colors ${
              (dragHref ?? (isActive(href) ? href : null)) === href
                ? "text-accent"
                : "text-muted"
            }`}
          >
            <span className="relative">
              <Icon className="h-[22px] w-[22px]" />
              {!!badge && (
                <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-caption2 font-semibold leading-none text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            {label}
          </a>
        ))}
      </div>

      <button
        type="button"
        aria-label="Search"
        onClick={() => openCommandPalette()}
        className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-full border border-line/70 bg-surface/75 text-ink shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150"
      >
        <SearchIcon className="h-[22px] w-[22px]" />
      </button>
    </nav>
  );
}
