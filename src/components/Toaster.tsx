"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { onToast, type ToastEvent } from "@/lib/toast-bus";
import { CheckIcon, XIcon } from "./icons";

type Item = ToastEvent & { id: number };

/**
 * Bottom-centre toast stack; listens to the toast bus. On phones it sits
 * above the floating tab bar. A toast can carry one action (e.g. Undo).
 */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(
    () =>
      onToast((t) => {
        const id = Date.now() + Math.random();
        setItems((prev) => [...prev.slice(-2), { ...t, id }]);
        setTimeout(
          () => setItems((prev) => prev.filter((i) => i.id !== id)),
          t.duration ?? 3500,
        );
      }),
    [],
  );

  const dismiss = (id: number) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full border border-line/70 bg-surface/90 py-2 pl-4 pr-2 text-sm text-ink shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl"
          >
            {t.kind === "success" && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
                <CheckIcon className="h-3 w-3" />
              </span>
            )}
            {t.kind === "error" && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
                <XIcon className="h-3 w-3" />
              </span>
            )}
            <span className="min-w-0 py-0.5 pr-2">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onAction();
                  dismiss(t.id);
                }}
                className="min-h-9 shrink-0 rounded-full bg-ivory px-3.5 text-sm font-semibold text-accent transition-colors hover:bg-line"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
