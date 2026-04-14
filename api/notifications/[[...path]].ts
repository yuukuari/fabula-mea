import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';
import { getRedisJson } from '../_lib/utils';

const NOTIFICATIONS_KEY = 'emlb:notifications';

function readsKey(userId: string) {
  return `emlb:u:${userId}:notification-reads`;
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const action = req.query.action as string | undefined;

  // GET /api/notifications — list notifications for current user
  if (req.method === 'GET') {
    const all = await getRedisJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
    const notifications = all.filter((n) => n.recipientIds.includes(auth.userId));
    const readIds = await getRedisJson<string[]>(readsKey(auth.userId), []);
    return res.json({ notifications, readIds });
  }

  // POST /api/notifications?action=read — mark one notification as read
  if (req.method === 'POST' && action === 'read') {
    const { notificationId } = req.body;
    if (!notificationId) return res.status(400).json({ error: 'notificationId requis' });

    const readIds = await getRedisJson<string[]>(readsKey(auth.userId), []);
    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId);
      await redis.set(readsKey(auth.userId), JSON.stringify(readIds));
    }
    return res.json({ ok: true });
  }

  // POST /api/notifications?action=readAll — mark all as read
  if (req.method === 'POST' && action === 'readAll') {
    const all = await getRedisJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
    const myNotifIds = all.filter((n) => n.recipientIds.includes(auth.userId)).map((n) => n.id);
    await redis.set(readsKey(auth.userId), JSON.stringify(myNotifIds));
    return res.json({ ok: true });
  }

  // POST /api/notifications?action=readByPayload — mark notifications matching a payload key/value
  if (req.method === 'POST' && action === 'readByPayload') {
    const { key, value } = req.body;
    if (!key || !value) return res.status(400).json({ error: 'key et value requis' });

    const all = await getRedisJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
    const readIds = await getRedisJson<string[]>(readsKey(auth.userId), []);
    const toMark = all
      .filter((n) => n.recipientIds.includes(auth.userId) && n.payload[key] === value)
      .map((n) => n.id);
    const newReadIds = [...new Set([...readIds, ...toMark])];
    await redis.set(readsKey(auth.userId), JSON.stringify(newReadIds));
    return res.json({ ok: true });
  }

  // POST /api/notifications?action=push — register push subscription
  if (req.method === 'POST' && action === 'push') {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'subscription requis' });
    await redis.set(`emlb:u:${auth.userId}:push-subscription`, JSON.stringify(subscription));
    return res.json({ ok: true });
  }

  // DELETE /api/notifications?action=push — unregister push subscription
  if (req.method === 'DELETE' && action === 'push') {
    await redis.del(`emlb:u:${auth.userId}:push-subscription`);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
