const CACHE = 'taxi-pay-v1.4-beta-20260805-phase7-r6';

const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './tax-table-2026.js',
  './manifest.json',
  './firebase-config.js',
  './firebase-auth.js',
  './diagnostics.js',
  './boot.js',
  './v13-features.js',
  './phase1-ui.js',
  './phase2-user-settings.js',
  './phase3-personal-settings.js',
  './phase4-payroll-adjustments.js',
  './phase7-ui.js',
  './admin.html',
  './announcement.html',
  './announcement-admin.js',
  './admin.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((response) => response || caches.match('./index.html'))
      )
  );
});
