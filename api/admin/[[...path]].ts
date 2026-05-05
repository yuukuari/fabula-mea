import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';
import { getPathSegments } from '../_lib/utils';
import { getUsageSummary, setUserLimits, type AiLimits } from '../_lib/ai-usage';

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  spotifyEnabled?: boolean;
  createdAt: string;
}

async function isAdmin(userId: string): Promise<boolean> {
  const json = await redis.get(`emlb:user:${userId}`);
  if (!json) return false;
  const user = JSON.parse(json) as User;
  return user.isAdmin === true;
}

// ─── /admin/members ─────────────────────────────────────────────────────────

async function handleMembers(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'PATCH') {
    const { userId, spotifyEnabled } = req.body as { userId?: string; spotifyEnabled?: boolean };
    if (!userId || typeof spotifyEnabled !== 'boolean') {
      return res.status(400).json({ error: 'userId et spotifyEnabled requis' });
    }
    const userJson = await redis.get(`emlb:user:${userId}`);
    if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const user = JSON.parse(userJson) as User;
    user.spotifyEnabled = spotifyEnabled;
    await redis.set(`emlb:user:${userId}`, JSON.stringify(user));
    return res.json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();

  const memberIdsJson = await redis.get('emlb:member-ids');
  const memberIds: string[] = memberIdsJson ? JSON.parse(memberIdsJson) : [];

  const members: Array<{ id: string; email: string; name: string; isAdmin: boolean; spotifyEnabled: boolean; createdAt: string }> = [];
  for (const memberId of memberIds) {
    const userJson = await redis.get(`emlb:user:${memberId}`);
    if (userJson) {
      const user = JSON.parse(userJson) as User;
      members.push({
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin ?? false,
        spotifyEnabled: user.spotifyEnabled ?? false,
        createdAt: user.createdAt,
      });
    }
  }
  return res.json({ members });
}

// ─── /admin/users/:id, /admin/users/:id/ai-limits ───────────────────────────

async function handleUserDetail(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') return res.status(405).end();
  const userJson = await redis.get(`emlb:user:${userId}`);
  if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const user = JSON.parse(userJson) as User;

  const libraryJson = await redis.get(`emlb:u:${userId}:library`);
  const library: unknown[] = libraryJson ? JSON.parse(libraryJson) : [];

  const usage = await getUsageSummary(userId);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin ?? false,
      createdAt: user.createdAt,
    },
    booksCount: library.length,
    usage,
  });
}

async function handleUserAiLimits(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'PUT') return res.status(405).end();
  const userJson = await redis.get(`emlb:user:${userId}`);
  if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const { limits } = req.body as { limits?: AiLimits | null };
  if (limits !== null && (typeof limits !== 'object' || !limits.perWeek)) {
    return res.status(400).json({ error: 'limits invalide' });
  }
  await setUserLimits(userId, limits ?? null);
  return res.json({ ok: true });
}

// ─── Router ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const admin = await isAdmin(auth.userId);
  if (!admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });

  const segments = getPathSegments(req, '/api/admin');
  const [head, mid, tail] = segments;

  if (head === 'members') return handleMembers(req, res);

  if (head === 'users' && typeof mid === 'string') {
    if (!tail) return handleUserDetail(req, res, mid);
    if (tail === 'ai-limits') return handleUserAiLimits(req, res, mid);
  }

  return res.status(404).json({ error: 'Route introuvable' });
}
