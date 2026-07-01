// This file exists solely to evict any stale service worker cached by previous deployments.
// No caching is performed — all requests fall through to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  await self.registration.unregister();
  await self.clients.claim();
});
