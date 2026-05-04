// Service Worker — offline cache + push notifications.
const CACHE = 'tech-news-v1';
const PRECACHE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// Stale-while-revalidate for navigation + same-origin GETs.
// Network-first for /api/* so users always see fresh data when online.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Push notification — server sends JSON {title, body, url}.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch (_) {}
  const title = data.title || '매일 기술 뉴스';
  const options = {
    body: data.body || '오늘의 다이제스트가 도착했습니다.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'daily-digest',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of clients) {
        if (c.url.includes(self.location.origin)) {
          c.focus();
          c.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
