// Service Worker：アプリのファイルを端末にキャッシュし、電波がなくても起動できるようにする。
// 記録データは扱わない（IndexedDB に保存され、ここを通らない）。外部への通信もしない。
//
// 更新の流れ：VERSION を上げて公開 → 新しい版がファイルを取得して待機 → 画面に「新しい版があります」
// → 利用者が［更新］を押す → 切り替わり、古い版のキャッシュを消す。

// js/version.js の APP_VERSION と同じにする（tests/version.test.js で確認）
const VERSION = '1.0.2';
const CACHE_PREFIX = 'workout-log-';
const CACHE = `${CACHE_PREFIX}v${VERSION}`;

// 起動に必要なファイル。すべてこのファイルからの相対パス（GitHub Pages のサブディレクトリでも動くように）
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/backup-status.js',
  './js/db.js',
  './js/defaults.js',
  './js/state.js',
  './js/theme.js',
  './js/util.js',
  './js/version.js',
  './js/logic/exporter.js',
  './js/logic/kinds.js',
  './js/logic/migrate.js',
  './js/logic/progression.js',
  './js/logic/stats.js',
  './js/ui/chart.js',
  './js/ui/dom.js',
  './js/ui/editors.js',
  './js/ui/share.js',
  './js/views/analysis.js',
  './js/views/body.js',
  './js/views/history.js',
  './js/views/record.js',
  './js/views/settings.js',
];

self.addEventListener('install', (event) => {
  // HTTP のキャッシュを通さず、必ず最新のファイルを取りにいく
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // すぐには切り替えない。利用者が［更新］を押したときに skipWaiting する
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 画面を開くときはキャッシュした index.html を返す（オフラインでも起動する）
    event.respondWith((async () => {
      const cached = await caches.match(new URL('./index.html', self.registration.scope).href, { cacheName: CACHE });
      return cached || fetch(req);
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req, { cacheName: CACHE, ignoreSearch: true });
    return cached || fetch(req);
  })());
});
