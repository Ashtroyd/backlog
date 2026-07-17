"use client";

import { useEffect, useRef } from "react";

/**
 * Escape-to-close and focus restoration for a dropdown/menu that isn't built
 * on Modal.tsx (which already handles this). Captures whatever had focus
 * when the menu opened — normally its trigger button — and returns focus
 * there on close.
 */
export function useDismissableMenu(open: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    } else {
      triggerRef.current?.focus?.();
      triggerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}
