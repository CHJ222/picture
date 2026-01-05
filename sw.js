
const CACHE_NAME = 'magic-book-v1';
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  // 仅作为占位符以通过 PWA 验证
  e.respondWith(fetch(e.request));
});
