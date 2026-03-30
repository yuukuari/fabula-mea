import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
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
  if (req.method !== 'GET') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const admin = await isAdmin(auth.userId);
  if (!admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });

  // We need to iterate all users. Since we store users individually (emlb:user:{id}),
  // we need a way to list them. We'll use an index key.
  const memberIdsJson = await redis.get('emlb:member-ids');
  const memberIds: string[] = memberIdsJson ? JSON.parse(memberIdsJson) : [];

  const members: Array<{ id: string; email: string; name: string; isAdmin: boolean; createdAt: string }> = [];

  for (const memberId of memberIds) {
    const userJson = await redis.get(`emlb:user:${memberId}`);
    if (userJson) {
      const user = JSON.parse(userJson) as User;
      members.push({
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin ?? false,
        createdAt: user.createdAt,
      });
    }
  }

  return res.json({ members });
}
