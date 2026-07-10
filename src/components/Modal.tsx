"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

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
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className={`w-full ${
                  wide ? "max-w-2xl" : "max-w-xl"
                } rounded-2xl border border-line bg-surface shadow-[0_24px_60px_rgba(38,37,33,0.18)]`}
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
