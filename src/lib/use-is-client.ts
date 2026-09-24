"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during the server render and hydration, true afterwards — for
 * reading browser-only state (localStorage, portals to <body>) without a
 * hydration mismatch or a set-state-on-mount effect.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
