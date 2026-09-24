"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { onTourStart } from "@/lib/tour-bus";
import { XIcon } from "./icons";

type TourStep = {
  target: string;
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    target: "add-button",
    title: "Add anything",
    body: "Search across Steam, IMDb, TVMaze, or MyAnimeList — covers, years, and details fill themselves in.",
  },
  {
    target: "import-button",
    title: "Bring your history with you",
    body: "Already tracking elsewhere? Import your whole library from Steam, MyAnimeList, or Letterboxd in one go — including your written reviews.",
  },
  {
    target: "filter-tabs",
    title: "Filter by status",
    body: "Jump between Backlog, Playing, Completed, and Dropped.",
  },
  {
    target: "item-card",
    title: "Quick actions on hover",
    body: "Hover any title to change its status or favourite it without opening the full view. Click through for ratings, notes, and pinning to Up next.",
  },
  {
    target: "notifications",
    title: "Stay in the loop",
    body: "Friend requests and your friends' activity show up here.",
  },
];

const TOOLTIP_WIDTH = 320;
const PADDING = 8;

/** First *visible* element for a tour target — some (the notification bell)
    render in both the top bar and the sidebar, with one hidden by CSS. */
function findTarget(target: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const el of all) if (el.getClientRects().length > 0) return el;
  return null;
}

export function FeatureTour() {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (!steps) return;
    const step = steps[stepIndex];
    const el = step && findTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [steps, stepIndex]);

  // Start: find which of the steps' targets actually exist right now.
  useEffect(
    () =>
      onTourStart(() => {
        const available = STEPS.filter((s) =>
          findTarget(s.target),
        );
        if (available.length === 0) return;
        setSteps(available);
        setStepIndex(0);
      }),
    [],
  );

  // Keep the spotlight glued to its target through scroll/resize/animation.
  useEffect(() => {
    if (!steps) return undefined;
    const step = steps[stepIndex];
    const el = findTarget(step.target);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });

    const tick = () => {
      measure();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [steps, stepIndex, measure]);

  useEffect(() => {
    if (!steps) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  function finish() {
    try {
      localStorage.setItem("backlog:tourSeen", "true");
    } catch {
      // ignore
    }
    setSteps(null);
    setStepIndex(0);
    setRect(null);
  }

  if (!steps || !rect) return null;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const spotlightPad = 6;
  const spotlightStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - spotlightPad,
    left: rect.left - spotlightPad,
    width: rect.width + spotlightPad * 2,
    height: rect.height + spotlightPad * 2,
    borderRadius: 12,
    boxShadow: "0 0 0 9999px rgba(20, 18, 14, 0.65)",
    pointerEvents: "none",
    zIndex: 100,
  };

  // Prefer below the target; flip above if there isn't room; clamp horizontally.
  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < 200 && rect.top > 200;
  const top = above ? undefined : Math.min(rect.bottom + 16, window.innerHeight - 16);
  const bottom = above ? window.innerHeight - rect.top + 16 : undefined;
  const left = Math.min(
    Math.max(rect.left, PADDING),
    window.innerWidth - TOOLTIP_WIDTH - PADDING,
  );

  // No full-page backdrop: the rest of the app stays interactive during the
  // tour (a new user clicking the spotlighted "Add" button should actually
  // open it, not just dismiss the tooltip) — only the spotlight ring and
  // tooltip card render on top.
  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <div style={spotlightStyle} />
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          // Callback ref (not useRef+useEffect): AnimatePresence's
          // mode="wait" delays mounting this until the previous step's exit
          // animation finishes, so a plain effect keyed on stepIndex would
          // try to focus before the node exists.
          ref={(el) => el?.focus()}
          tabIndex={-1}
          role="dialog"
          aria-label="Feature tour"
          initial={{ opacity: 0, y: above ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ position: "fixed", top, bottom, left, width: TOOLTIP_WIDTH }}
          className="pointer-events-auto z-[101] rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_rgba(38,37,33,0.24)] focus:outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-base font-semibold text-ink">{step.title}</p>
            <button
              type="button"
              onClick={finish}
              aria-label="Skip tour"
              className="-m-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-body">{step.body}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted">
              {stepIndex + 1} of {steps.length}
            </span>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i - 1)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-ivory hover:text-ink"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
                className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
