const CACHE_NAME = "parchar-shell-v9";
const OFFLINE_URL = "/offline.html";

const CORE_ASSETS = [
  "/index.html",
  "/loading.html",
  "/places.html",
  "/clients.html",
  "/styles.css",
  "/app.js",
  "/ads.js",
  "/places.js",
  "/clients.js",
  "/manifest.webmanifest",
  "/assets/parchar-logo.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon-180.png",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached =
          (await cache.match(request, {
            ignoreSearch: true,
          })) ||
          (await cache.match("/index.html")) ||
          (await cache.match(OFFLINE_URL));

        const networkPromise = fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200
            ) {
              cache.put(
                request,
                networkResponse.clone()
              );
            }

            return networkResponse;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const networkResponse =
          await networkPromise;

        return (
          networkResponse ||
          (await cache.match(OFFLINE_URL))
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200
        ) {
          return networkResponse;
        }

        const responseCopy =
          networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseCopy);
        });

        return networkResponse;
      });
    })
  );
});
