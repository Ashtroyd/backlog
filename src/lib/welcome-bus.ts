"use client";

/**
 * Tiny pub/sub so the welcome sheet can be opened from anywhere (the
 * account sheet, or AppShell's first-run check) without threading state
 * through every layout. Mirrors toast-bus.ts.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function onWelcomeOpen(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openWelcome() {
  listeners.forEach((fn) => fn());
}
