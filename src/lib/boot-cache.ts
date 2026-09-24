"use client";

/**
 * Last-seen copies of small, per-user data (profile, Up Next shelves) kept
 * in localStorage, so a cold start can draw them at once and refresh them
 * quietly. Each entry is tagged with its user; another account never sees
 * it, and signing out clears them all.
 */

const PREFIX = "backlog:cache:";

type Entry<T> = { userId: string; value: T };

export function readUserCache<T>(name: string, userId: string | null): T | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    return entry.userId === userId ? entry.value : null;
  } catch {
    return null;
  }
}

export function writeUserCache<T>(name: string, userId: string, value: T) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify({ userId, value }));
  } catch {
    // Storage full or unavailable: the next start just loads normally.
  }
}

export function clearUserCaches() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/** The stored entry whoever it belongs to — for seeding state before the
    session (and so the user id) is known; compare `userId` before use. */
export function peekUserCache<T>(name: string): { userId: string; value: T } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? (JSON.parse(raw) as { userId: string; value: T }) : null;
  } catch {
    return null;
  }
}
