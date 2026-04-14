// Fabula Mea — Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'fabula-mea',
      data: { link: data.link || '/' },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Fabula Mea', options)
    );
  } catch {
    // Fallback for non-JSON payloads
    event.waitUntil(
      self.registration.showNotification('Fabula Mea', {
        body: event.data.text(),
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      // Open new window
      return self.clients.openWindow(link);
    })
  );
});
