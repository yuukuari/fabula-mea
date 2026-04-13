import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  spotifyEnabled?: boolean;
  createdAt: string;
  passwordHash?: string;
}

async function isAdmin(userId: string): Promise<boolean> {
  const json = await redis.get(`emlb:user:${userId}`);
  if (!json) return false;
  const user = JSON.parse(json) as User;
  return user.isAdmin === true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'PATCH') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const admin = await isAdmin(auth.userId);
  if (!admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });

  // ─── PATCH: toggle spotifyEnabled for a user ───
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

  // ─── GET: list all members ───
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
