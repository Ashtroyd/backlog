"use client";

import { usePathname } from "next/navigation";
import { SECTIONS, type SectionSlug } from "./sections";
import { useIsClient } from "./use-is-client";

const KEY = "backlog:lastSection";

/** The Library segment you last had open, so the Library tab reopens it. */
export function readLastSection(): SectionSlug {
  try {
    const v = localStorage.getItem(KEY);
    if (v && Object.hasOwn(SECTIONS, v)) return v as SectionSlug;
  } catch {
    // storage unavailable — fall through to the default
  }
  return "games";
}

export function rememberSection(slug: SectionSlug) {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    // ignore
  }
}

/** Href for the Library tab: `/games` until a visit says otherwise. */
export function useLibraryHref(): string {
  // On a section, that's the answer (Library saves it in an effect, after
  // this renders); anywhere else, re-read storage after each navigation.
  const pathname = usePathname();
  const isClient = useIsClient();
  const here = pathname.split("/")[1];
  if (Object.hasOwn(SECTIONS, here)) return `/${here}`;
  return `/${isClient ? readLastSection() : "games"}`;
}

/** Top-level destinations, shared by the tab bar, top bar and sidebar. */
export type TabKey = "upnext" | "library" | "friends";

export function activeTab(pathname: string): TabKey | null {
  if (pathname === "/") return "upnext";
  const first = pathname.split("/")[1] ?? "";
  if (first === "library" || first in SECTIONS) return "library";
  if (first === "friends" || first === "messages" || first === "shared")
    return "friends";
  return null;
}
