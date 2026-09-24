"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SECTIONS, type SectionSlug } from "./sections";

const KEY = "backlog:lastSection";

/** The Library segment you last had open, so the Library tab reopens it. */
export function readLastSection(): SectionSlug {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in SECTIONS) return v as SectionSlug;
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
  const pathname = usePathname();
  const [slug, setSlug] = useState<SectionSlug>("games");
  useEffect(() => {
    setSlug(readLastSection());
  }, [pathname]);
  return `/${slug}`;
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
