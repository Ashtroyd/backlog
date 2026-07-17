"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Shared animated dialog: blurred backdrop, sprung panel, Esc / click-away to close. */
export function Modal({
  open,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const generatedId = useId();
  const [labelledBy, setLabelledBy] = useState<string | undefined>(undefined);

  // Capture whatever's focused on the exact closed→open transition, during
  // render — not in an effect. A consumer's autoFocus (e.g. AddModal's
  // search input) applies during commit, before any passive effect of ours
  // would run, so by the time an effect checked document.activeElement it
  // was already the wrong element.
  if (open && !wasOpen.current && typeof document !== "undefined") {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
  }
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: keep Tab cycling within the dialog instead of escaping
      // into the page behind it.
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Move focus into the dialog on open (unless a consumer's autoFocus
  // already landed it there), and restore it to whatever triggered the
  // dialog once it closes.
  useEffect(() => {
    if (open) {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE);
        (firstFocusable ?? panel).focus();
      }
    } else {
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    }
  }, [open]);

  // Label the dialog with whatever heading the content renders, so a screen
  // reader announces more than just "dialog".
  useEffect(() => {
    if (!open) return;
    const heading = panelRef.current?.querySelector<HTMLElement>("h1, h2");
    if (!heading) return;
    if (!heading.id) heading.id = generatedId;
    setLabelledBy(heading.id);
  }, [open, generatedId]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/*
            The scroll area is sized to the *dynamic* viewport (h-[100dvh]).
            `inset-0` alone resolves to the large viewport on mobile Safari, so
            tall dialogs looked like they fit while their footer hid behind the
            browser chrome — and the browser saw nothing to scroll. `inset-0`
            stays as the fallback for engines without dvh support.

            It also owns pointer events: with `pointer-events: none` a drag that
            didn't start exactly on the card scrolled nothing. Clicks that land
            on the padding (not the card) still dismiss the dialog.
          */}
          <div
            onClick={onClose}
            className="absolute inset-0 h-[100dvh] overflow-y-auto overscroll-contain"
          >
            <div className="flex min-h-full items-start justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 sm:pt-[10vh]">
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className={`w-full ${
                  wide ? "max-w-2xl" : "max-w-xl"
                } rounded-2xl border border-line bg-surface shadow-[0_24px_60px_rgba(38,37,33,0.18)] focus:outline-none`}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              >
                {children}
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
