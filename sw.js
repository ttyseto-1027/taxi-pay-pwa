const CACHE = 'taxi-pay-v1.4-beta-20260825-12-mobile-keypad';

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

  const isNavigation = event.request.mode === 'navigate';
  const isRuntimeControlFile =
    /\/(?:app-meta\.js|app-meta\.json|phase75-ops\.js|sw\.js)$/.test(url.pathname);

  // 更新判定に使うファイルとHTMLナビゲーションは常にネットワーク優先・HTTPキャッシュ不使用。
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
        .catch(() =>
          caches.match(event.request).then((response) => response || caches.match('./index.html'))
        )
    );
    return;
  }

  // その他の静的ファイルもネットワーク優先。
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((response) => response || caches.match('./index.html'))
      )
  );
});
