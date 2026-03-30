import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

interface Release {
  id: string;
  [key: string]: unknown;
}

interface User {
  id: string;
  isAdmin?: boolean;
}

async function isAdmin(userId: string): Promise<boolean> {
  const json = await redis.get(`emlb:user:${userId}`);
  if (!json) return false;
  const user = JSON.parse(json) as User;
  return user.isAdmin === true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'ID invalide' });

  const releasesJson = await redis.get('emlb:releases');
  const releases: Release[] = releasesJson ? JSON.parse(releasesJson) : [];
  const releaseIdx = releases.findIndex((r) => r.id === id);

  if (req.method === 'GET') {
    if (releaseIdx === -1) return res.status(404).json({ error: 'Release introuvable' });
    return res.json(releases[releaseIdx]);
  }

  // PATCH and DELETE require admin
  const auth = requireAuth(req, res);
  if (!auth) return;

  const admin = await isAdmin(auth.userId);
  if (!admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });

  if (releaseIdx === -1) return res.status(404).json({ error: 'Release introuvable' });

  if (req.method === 'PATCH') {
    const updated = { ...releases[releaseIdx], ...req.body, updatedAt: new Date().toISOString() };
    releases[releaseIdx] = updated;
    await redis.set('emlb:releases', JSON.stringify(releases));
    return res.json({ release: updated });
  }

  if (req.method === 'DELETE') {
    releases.splice(releaseIdx, 1);
    await redis.set('emlb:releases', JSON.stringify(releases));
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
