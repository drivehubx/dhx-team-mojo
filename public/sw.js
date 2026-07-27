/* DHX Body & Paint service worker — /sw.js
 * Network-first for HTML/navigation so new deploys are never trapped behind an old page.
 * Cache-first only for safe, versioned static assets. Never caches Supabase API/auth/DB/signed-storage.
 */
const VERSION = 'dhx-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Supabase API / auth / database / signed storage — never cache, always go to network.
function isNoCache(url) {
  return (
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.supabase.in') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/storage/')
  );
}

// Only safe, static assets are cacheable.
function isStaticAsset(url, req) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/assets/')) return true; // hashed JS/CSS from the build
  const dest = req.destination;
  if (dest === 'script' || dest === 'style' || dest === 'font' || dest === 'image') return true;
  return /\.(?:js|css|woff2?|png|jpe?g|svg|ico|webmanifest)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }

  if (isNoCache(url)) return; // never cache — default network handling

  // HTML / navigations: network-first so deployed UI changes appear on next load.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/offline.html')) || Response.error())
    );
    return;
  }

  // Safe static assets: cache-first with background refresh (stale-while-revalidate).
  if (isStaticAsset(url, req)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
  // Everything else: no respondWith — default network handling.
});
