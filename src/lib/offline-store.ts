"use client";

/**
 * A small IndexedDB key–value store for data too big for localStorage —
 * each Library section's full item list — so sections open offline and
 * paint before the network answers. Every call fails soft: no IndexedDB
 * (private mode, old browser) just means no offline copy.
 */

const DB = "backlog";
const STORE = "cache";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function offlineGet<T>(key: string): Promise<T | null> {
  try {
    return ((await run<T | undefined>("readonly", (s) => s.get(key))) ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function offlineSet<T>(key: string, value: T): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(value, key));
  } catch {
    // No offline copy this time.
  }
}

export async function offlineClear(): Promise<void> {
  try {
    await run("readwrite", (s) => s.clear());
  } catch {
    // ignore
  }
}
