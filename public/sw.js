/*
 * Backlog's service worker: keeps the app itself on the device so it opens
 * with no connection. The data (library, profile, Up Next) is saved by the
 * app in IndexedDB/localStorage; this only handles the files around it.
 *
 * - /_next/static/*   cache-first — build files are content-hashed, so a
 *                     cached copy never goes stale.
 * - pages             network-first (fresh when online), falling back to
 *                     the last copy of that page, then of Up Next. Pages
 *                     carry no personal data — the app draws that in the
 *                     browser — so caching them is safe.
 * - /_next/image      covers: served from cache, refreshed in the background.
 * - everything else   (API routes, Supabase, other sites) untouched.
 */

const STATIC = "backlog-static-v1";
const PAGES = "backlog-pages-v1";
const IMAGES = "backlog-images-v1";
const KEEP = [STATIC, PAGES, IMAGES];
const NETWORK_TIMEOUT_MS = 4000;
// Every tab's page, so a cold start — or switching tabs offline, which
// falls back to a full page load — always has something to open.
const APP_PAGES = [
  "/",
  "/games",
  "/movies",
  "/series",
  "/anime",
  "/friends",
  "/messages",
  "/shared",
  "/profile",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => Promise.all(APP_PAGES.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page loaded its build files before this worker was in control, so it
// sends their URLs over to be saved too.
self.addEventListener("message", (event) => {
  const urls = event.data?.type === "cache-urls" ? event.data.urls : null;
  if (!Array.isArray(urls)) return;
  event.waitUntil(
    caches.open(STATIC).then((cache) =>
      Promise.all(
        urls
          .filter((u) => new URL(u, self.location.origin).pathname.startsWith("/_next/static/"))
          .map((u) => cache.match(u).then((hit) => hit || cache.add(u).catch(() => {}))),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request, IMAGES, 300));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  const key = stripQuery(request.url);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(key, response.clone());
    return response;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    // Offline, or slow enough that a saved copy is the better answer.
    const saved = (await cache.match(key)) || (await cache.match("/"));
    if (saved) return saved;
    try {
      return await network;
    } catch {
      return new Response("You're offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }
}

async function staleWhileRevalidate(request, name, maxEntries) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        trim(cache, maxEntries);
      }
      return response;
    })
    .catch(() => hit);
  return hit || refresh;
}

/** Oldest-first eviction so covers can't grow the cache without limit. */
async function trim(cache, maxEntries) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}

function stripQuery(href) {
  const u = new URL(href);
  u.search = "";
  return u.href;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
