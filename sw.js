const CACHE = 'taxi-pay-v1.4-beta-20261016-production-help-02';

const FILES = [
  './',
  './index.html',
  './styles.css',
  './storage-safety.js',
  './data-integrity-v14.js',
  './data-recovery-v14.js',
  './phase11-archive-restore.js',
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
  './device-registry-v14.js',
  './admin.html',
  './announcement.html',
  './announcement-admin.js',
  './admin.js',
  './system-info.js',
  './system-info.html',
  './phase75-ops.js',
  './app-meta.json',
  './app-meta.js',
  './google-drive-config.js',
  './phase56-drive-backup.js',
  './profile-diagnostics.js'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  const isRuntimeControlFile =
    /\/(?:app-meta\.js|app-meta\.json|phase75-ops\.js|phase7-ui\.js|device-registry-v14\.js|phase11-archive-restore\.js|sw\.js)$/.test(url.pathname);

  if (isNavigation || isRuntimeControlFile) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((response) => response || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => response || caches.match('./index.html')))
  );
});
