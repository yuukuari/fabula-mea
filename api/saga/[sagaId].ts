import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { sagaId } = req.query as { sagaId: string };
  if (!sagaId) return res.status(400).json({ error: 'sagaId manquant' });

  const key = `emlb:u:${auth.userId}:saga:${sagaId}`;

  if (req.method === 'GET') {
    const json = await redis.get(key);
    if (!json) return res.status(404).json({ error: 'Saga introuvable' });
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
