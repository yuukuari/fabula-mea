import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
import { cors } from '../../_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const { token } = req.query;
  if (typeof token !== 'string') return res.status(400).json({ error: 'Token requis' });

  if (req.method === 'GET') {
    const sessionJson = await redis.get(`emlb:review:token:${token}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);
    return res.json({ session });
  }

  return res.status(405).end();
}
