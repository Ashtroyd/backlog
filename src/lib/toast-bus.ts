"use client";

/**
 * Tiny pub/sub so non-component code (the data stores) can raise toasts
 * without threading React context through every call site.
 */

export type ToastKind = "success" | "error" | "info";
export type ToastEvent = { kind: ToastKind; message: string };

type Listener = (t: ToastEvent) => void;
const listeners = new Set<Listener>();

export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toast(kind: ToastKind, message: string) {
  listeners.forEach((fn) => fn({ kind, message }));
}
