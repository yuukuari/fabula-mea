import { redis } from './redis';
import { getRedisJson } from './utils';

const webpush = require('web-push');

const NOTIFICATIONS_KEY = 'emlb:notifications';
const MAX_NOTIFICATIONS = 200;

interface AppNotification {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  message: string;
  link: string;
  payload: Record<string, string>;
  recipientIds: string[];
  createdAt: string;
}

// Configure VAPID keys if available
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contact@fabula-mea.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

/**
 * Send a Web Push notification to a single user.
 * Silently ignores errors (expired subscription, missing keys, etc.).
 */
function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function sendPushToUser(userId: string, notification: AppNotification): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  try {
    const subJson = await redis.get(`emlb:u:${userId}:push-subscription`);
    if (!subJson) return;

    const subscription = JSON.parse(subJson);
    // Skip local/dev subscriptions
    if (!subscription.endpoint || subscription.endpoint === 'local') return;

    const body = resolveTemplate(notification.message, { actorName: notification.actorName, ...notification.payload });

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: 'Fabula Mea',
        body,
        link: notification.link,
        tag: notification.id,
      })
    );
  } catch (err: any) {
    // 410 Gone = subscription expired → clean up
    if (err?.statusCode === 410) {
      await redis.del(`emlb:u:${userId}:push-subscription`);
    }
    // Other errors are silently ignored (network issues, etc.)
  }
}

/**
 * Create a notification and persist it in Redis.
 * Also sends Web Push to all recipients who have subscriptions.
 * Called by serverless functions (e.g. ticket comment handler).
 */
export async function createNotification(opts: {
  type: string;
  actorId: string;
  actorName: string;
  message: string;
  link: string;
  payload: Record<string, string>;
  recipientIds: string[];
}): Promise<AppNotification | null> {
  if (opts.recipientIds.length === 0) return null;

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const notification: AppNotification = {
    id,
    type: opts.type,
    actorId: opts.actorId,
    actorName: opts.actorName,
    message: opts.message,
    link: opts.link,
    payload: opts.payload,
    recipientIds: opts.recipientIds,
    createdAt: new Date().toISOString(),
  };

  const all = await getRedisJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
  all.unshift(notification);
  if (all.length > MAX_NOTIFICATIONS) all.length = MAX_NOTIFICATIONS;
  await redis.set(NOTIFICATIONS_KEY, JSON.stringify(all));

  // Send Web Push to all recipients (fire-and-forget, never blocks)
  Promise.allSettled(
    opts.recipientIds.map((uid) => sendPushToUser(uid, notification))
  ).catch(() => {});

  return notification;
}
