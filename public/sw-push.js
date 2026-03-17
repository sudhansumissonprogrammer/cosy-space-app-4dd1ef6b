// Service Worker for Web Push Notifications
// This file must be served from the root of the domain

self.addEventListener('install', (event) => {
  console.log('[sw-push] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[sw-push] Activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[sw-push] Push received');

  if (!event.data) {
    console.log('[sw-push] No data in push event');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'New Notification', body: event.data.text() };
  }

  console.log('[sw-push] Data:', JSON.stringify(data));

  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'store-notification-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
    },
    actions: data.url && data.url !== '/' ? [{ action: 'open', title: 'View' }] : [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[sw-push] Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
