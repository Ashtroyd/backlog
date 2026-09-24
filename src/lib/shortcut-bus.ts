"use client";

/**
 * Pub/sub for keyboard shortcuts that act on whatever page is showing, and
 * for opening the shortcuts sheet from the account sheet. Mirrors
 * command-palette-bus.ts.
 */

type Listener = () => void;
const addListeners = new Set<Listener>();
const helpListeners = new Set<Listener>();

/** A Library section registers here so N opens its Add sheet. */
export function onAddTitle(fn: Listener): () => void {
  addListeners.add(fn);
  return () => addListeners.delete(fn);
}

/** Returns false when no page offered an Add sheet. */
export function requestAddTitle(): boolean {
  addListeners.forEach((fn) => fn());
  return addListeners.size > 0;
}

export function onShortcutsOpen(fn: Listener): () => void {
  helpListeners.add(fn);
  return () => helpListeners.delete(fn);
}

export function openShortcuts() {
  helpListeners.forEach((fn) => fn());
}
