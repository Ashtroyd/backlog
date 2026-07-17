"use client";

/**
 * Tiny pub/sub so the feature tour can be triggered from anywhere (the Nav
 * menu, or AppShell's first-run check) without threading state through
 * every layout. Mirrors toast-bus.ts.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function onTourStart(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function startTour() {
  listeners.forEach((fn) => fn());
}
