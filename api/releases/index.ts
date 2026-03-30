import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { getAuthUser, requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface Release {
  id: string;
  version: string;
  title: string;
  description: string;
  status: 'planned' | 'current' | 'released';
  items: Array<{ id: string; type: string; description: string }>;
  ticketIds: string[];
  releasedAt?: string;
  createdAt: string;
  updatedAt: string;
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

  if (req.method === 'GET') {
    // Public - list all releases (no auth required, but we accept it)
    const releasesJson = await redis.get('emlb:releases');
    const releases: Release[] = releasesJson ? JSON.parse(releasesJson) : [];
    return res.json(releases);
  }

  if (req.method === 'POST') {
    // Create release - admin only
    const auth = requireAuth(req, res);
    if (!auth) return;

    const admin = await isAdmin(auth.userId);
    if (!admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });

    const { version, title, description, status, items, ticketIds, releasedAt } = req.body;
    if (!version || !title) return res.status(400).json({ error: 'Version et titre requis' });

    const release: Release = {
      id: generateId(),
      version,
      title,
      description: description ?? '',
      status: status ?? 'planned',
      items: items ?? [],
      ticketIds: ticketIds ?? [],
      releasedAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const releasesJson = await redis.get('emlb:releases');
    const releases: Release[] = releasesJson ? JSON.parse(releasesJson) : [];
    releases.push(release);
    await redis.set('emlb:releases', JSON.stringify(releases));

    return res.json({ release });
  }

  return res.status(405).end();
}
