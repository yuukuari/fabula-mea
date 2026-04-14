import { api } from '@/lib/api';

/**
 * Check if push notifications are supported by the browser.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current push permission state.
 */
export function getPushPermission(): NotificationPermission {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Register the service worker and subscribe to push notifications.
 * Returns true if successful.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Get existing subscription or create a new one
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // For Web Push, a VAPID public key is needed
      // In dev mode, we use local Notification API directly (no push server)
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        // No VAPID key → use local notifications only (dev mode)
        await api.notifications.registerPush({ endpoint: 'local' });
        return true;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }

    // Send subscription to server
    await api.notifications.registerPush(subscription.toJSON());
    return true;
  } catch {
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
    await api.notifications.unregisterPush();
  } catch {
    // Ignore errors
  }
}

/**
 * Show a local notification (used in dev mode or as a fallback).
 */
export function showLocalNotification(title: string, body: string, link?: string): void {
  if (!isPushSupported() || Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: `fabula-mea-${Date.now()}`,
  });

  if (link) {
    notification.onclick = () => {
      window.focus();
      window.location.href = link;
      notification.close();
    };
  }
}

/** Convert a base64 VAPID key to Uint8Array for PushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
