import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isAdmin?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const userJson = await redis.get(`emlb:user:${auth.userId}`);
  if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const user = JSON.parse(userJson) as User;
  return res.json({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin ?? false });
}
