"use client";

import { AnimatePresence, motion } from "motion/react";
import { useOnline } from "@/lib/use-online";

/** A quiet note at the top of the page while there's no connection. */
export function OfflineBanner() {
  const online = useOnline();
  return (
    <AnimatePresence initial={false}>
      {!online && (
        <motion.div
          role="status"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <p className="mt-4 rounded-xl bg-ivory px-4 py-2.5 text-footnote text-body">
            <span className="font-semibold text-ink">You&apos;re offline.</span>{" "}Showing
            what&apos;s saved on this device — changes can&apos;t be saved until you&apos;re
            back online.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
