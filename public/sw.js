/* DHX Body & Paint service worker
 * Network-first for navigations and API calls; cache is only a fallback.
 * Auto-activates new versions (skipWaiting + clients.claim).
 */
const VERSION = 'dhx-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.supabase.in')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache authenticated API / Supabase calls — network only, fall through on failure.
  if (isApiRequest(url)) {
    event.respondWith(fetch(req).catch(() => new Response('', { status: 504 })));
    return;
  }

  // Navigations: network-first, fall back to offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/offline.html')) || Response.error())
    );
    return;
  }

  // Same-origin static assets: cache-first with background refresh.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
