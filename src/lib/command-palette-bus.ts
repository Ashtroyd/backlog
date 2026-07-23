"use client";

/**
 * Tiny pub/sub so the command palette can be opened from anywhere (the Nav
 * button, a future keyboard shortcut hint, …) without threading state through
 * every layout. Mirrors tour-bus.ts.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function onCommandPaletteOpen(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openCommandPalette() {
  listeners.forEach((fn) => fn());
}
