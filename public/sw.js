/*
 * MantraSphere service worker.
 * - Pages: always from the network (listings, prices and sessions must be
 *   fresh); if the network is down, show /offline.html. Pages are never cached,
 *   so no personal data is stored by the worker.
 * - /_next/static/*: cache-first (file names are content hashes).
 * - /uploads/* listing photos: stale-while-revalidate, capped.
 * - API calls, POSTs and other origins are not touched.
 */
const VERSION = "v1";
const SHELL = `msr-shell-${VERSION}`;
const STATIC = `msr-static-${VERSION}`;
const IMAGES = `msr-img-${VERSION}`;
const MAX_IMAGES = 80;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/favicon-32.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("msr-") && ![SHELL, STATIC, IMAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html", { cacheName: SHELL })));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/uploads/") && !url.pathname.startsWith("/uploads/private")) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone()).then(() => trim(IMAGES, MAX_IMAGES));
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
});
