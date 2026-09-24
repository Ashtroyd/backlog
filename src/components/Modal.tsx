"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  type DragControls,
} from "motion/react";

/** Lets sheet content (e.g. a hero header) start the swipe-to-dismiss drag. */
const SheetDragContext = createContext<DragControls | null>(null);

/**
 * Wraps sheet content that should also drag the sheet down (a hero header,
 * say). Must render *inside* <Modal> to see its drag controls; outside a
 * phone sheet it's a plain div.
 */
export function SheetDragArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const controls = useContext(SheetDragContext);
  return (
    <div
      className={className}
      onPointerDown={controls ? (e) => controls.start(e) : undefined}
      style={controls ? { touchAction: "none" } : undefined}
    >
      {children}
    </div>
  );
}

/** Phones get bottom sheets; the breakpoint matches Tailwind's `sm`. */
function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared animated dialog: blurred backdrop, sprung panel, Esc / click-away to
 * close. With `sheet`, phones get an iOS page sheet instead — it rises from
 * the bottom with a grabber and closes on a downward swipe.
 */
export function Modal({
  open,
  onClose,
  children,
  wide = false,
  sheet = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  sheet?: boolean;
}) {
  const isPhone = useIsPhone();
  const asSheet = sheet && isPhone;
  const dragControls = useDragControls();
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
        // Sheets land focus on the sheet itself (announced as the dialog, no
        // focus ring on a button the user didn't choose); Tab moves inward.
        const firstFocusable = sheet
          ? null
          : panel.querySelector<HTMLElement>(FOCUSABLE);
        (firstFocusable ?? panel).focus({ preventScroll: true });
      }
    } else {
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    }
  }, [open, sheet]);

  // Label the dialog with whatever heading the content renders, so a screen
  // reader announces more than just "dialog".
  useEffect(() => {
    if (!open) return;
    const heading = panelRef.current?.querySelector<HTMLElement>("h1, h2");
    if (!heading) return;
    if (!heading.id) heading.id = generatedId;
    setLabelledBy(heading.id);
  }, [open, generatedId]);

  if (asSheet) {
    return (
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              tabIndex={-1}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.9 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) onClose();
              }}
              className="absolute inset-x-0 bottom-0 flex h-[calc(100dvh-max(2.75rem,env(safe-area-inset-top)))] flex-col overflow-hidden rounded-t-[14px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.25)] focus:outline-none"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", duration: 0.45, bounce: 0 }}
            >
              {/* Grabber: a bigger invisible strip makes it easy to catch. */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                style={{ touchAction: "none" }}
                className="absolute inset-x-0 top-0 z-20 flex h-6 justify-center pt-1.5"
              >
                <span className="h-[5px] w-9 rounded-full bg-white/70 shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)]" />
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                <SheetDragContext.Provider value={dragControls}>
                  {children}
                </SheetDragContext.Provider>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

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
