"use client";

import { toast } from "./toast-bus";

const UNDO_MS = 5000;

/**
 * Apple-style "do it now, offer Undo" in place of a confirmation dialog.
 * `hide` takes the thing off screen straight away; `commit` (the real,
 * irreversible delete) only runs once the Undo window closes. Undo calls
 * `restore` instead. If the page closes inside the window, nothing is
 * deleted — the safe way round.
 */
export function removeWithUndo({
  message,
  hide,
  restore,
  commit,
}: {
  message: string;
  hide: () => void;
  restore: () => void;
  commit: () => Promise<{ error: string | null }>;
}) {
  hide();
  let undone = false;
  const timer = setTimeout(async () => {
    if (undone) return;
    try {
      const result = await commit();
      if (result.error) {
        restore();
        toast("error", "Couldn't remove that. It's back in your library.");
      }
    } catch {
      restore();
      toast("error", "Couldn't remove that. It's back in your library.");
    }
  }, UNDO_MS);
  toast("info", message, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onAction: () => {
        undone = true;
        clearTimeout(timer);
        restore();
      },
    },
  });
}
