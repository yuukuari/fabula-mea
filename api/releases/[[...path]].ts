import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

function getPathSegments(req: VercelRequest, base: string): string[] {
  const url = (req.url || '').split('?')[0];
  const after = url.startsWith(base) ? url.slice(base.length) : '';
  const segments = after.split('/').filter(Boolean);
  // __index is a sentinel from vercel.json rewrites for bare routes
  if (segments.length === 1 && segments[0] === '__index') return [];
  return segments;
}

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

// --- Handlers ---

async function handleIndex(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const releasesJson = await redis.get('emlb:releases');
    const releases: Release[] = releasesJson ? JSON.parse(releasesJson) : [];
    return res.json(releases);
  }

  if (req.method === 'POST') {
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

async function handleById(req: VercelRequest, res: VercelResponse, id: string) {
  const releasesJson = await redis.get('emlb:releases');
  const releases: Release[] = releasesJson ? JSON.parse(releasesJson) : [];
  const releaseIdx = releases.findIndex((r) => r.id === id);

  if (req.method === 'GET') {
    if (releaseIdx === -1) return res.status(404).json({ error: 'Release introuvable' });
    return res.json(releases[releaseIdx]);
  }

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

// --- Router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const pathSegments = getPathSegments(req, '/api/releases');

  if (pathSegments.length === 0) {
    return handleIndex(req, res);
  }

  if (pathSegments.length === 1) {
    return handleById(req, res, pathSegments[0]);
  }

  return res.status(404).json({ error: 'Route introuvable' });
}
