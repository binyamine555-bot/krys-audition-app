/* =========================================================================
   Service Worker – Krys Audition PWA
   Cache hors-ligne complet pour fonctionnement autonome
   ========================================================================= */

const CACHE_NAME = "krys-audition-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/data.js",
  "./js/centers.js",
  "./js/utils.js",
  "./js/store.js",
  "./js/audio.js",
  "./js/calibration.js",
  "./js/clinical.js",
  "./js/audiogram.js",
  "./js/charts.js",
  "./js/training.js",
  "./js/pro.js",
  "./js/views.js",
  "./js/app.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => caches.match("./index.html"));
    })
  );
});
