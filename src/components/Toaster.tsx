"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { onToast, type ToastEvent } from "@/lib/toast-bus";
import { CheckIcon, XIcon } from "./icons";

type Item = ToastEvent & { id: number };

/** Bottom-centre toast stack; listens to the toast bus. */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(
    () =>
      onToast((t) => {
        const id = Date.now() + Math.random();
        setItems((prev) => [...prev.slice(-2), { ...t, id }]);
        setTimeout(
          () => setItems((prev) => prev.filter((i) => i.id !== id)),
          3500,
        );
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-[0_12px_32px_rgba(38,37,33,0.18)]"
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
            <span className="min-w-0">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
