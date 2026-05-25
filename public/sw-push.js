/**
 * sw-push.js — Push-only service worker.
 *
 * It is also imported by the VitePWA worker in preview/local builds.
 * No fetch handler is registered, so it never caches or serves app pages.
 * Handles:
 *   - 'push'              → showNotification (rich UI with vibration)
 *   - 'notificationclick' → focus dashboard or open target URL
 *
 * Foreground tabs receive a postMessage so the dashboard can play a sound.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "New notification", body: event.data.text() };
  }

  const {
    title = "New Order",
    body = "",
    icon = "/pwa-192x192.png",
    badge = "/pwa-192x192.png",
    image,
    url = "/dashboard",
    tag,
    silent = false,
    requireInteraction = true,
    data = {},
  } = payload;

  const options = {
    body,
    icon,
    badge,
    image,
    tag: tag || `notif-${Date.now()}`,
    requireInteraction,
    silent,
    vibrate: silent ? undefined : [200, 100, 200, 100, 200],
    data: { ...data, url, ts: Date.now() },
    actions: payload.actions || [
      { action: "open", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  // Notify any open windows so they can play a custom sound in-page
  const notifyClients = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((c) =>
        c.postMessage({ type: "PUSH_RECEIVED", payload: { title, body, url, data } }),
      );
    })
    .catch(() => {});

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      notifyClients,
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          try {
            const cu = new URL(c.url);
            if (cu.origin === self.location.origin && "focus" in c) {
              c.focus();
              if ("navigate" in c) c.navigate(url).catch(() => {});
              return;
            }
          } catch {
            /* noop */
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
