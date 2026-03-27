import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { bookId } = req.query as { bookId: string };
  if (!bookId) return res.status(400).json({ error: 'bookId manquant' });

  const key = `emlb:u:${auth.userId}:book:${bookId}`;

  if (req.method === 'GET') {
    const json = await redis.get(key);
    if (!json) return res.status(404).json({ error: 'Livre introuvable' });
    return res.json(JSON.parse(json));
  }

  if (req.method === 'POST') {
    await redis.set(key, JSON.stringify(req.body));
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await redis.del(key);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
