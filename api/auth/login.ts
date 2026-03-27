import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { comparePassword, signToken } from '../_lib/auth';
import { cors } from '../_lib/cors';

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const normalized = email.toLowerCase().trim();
  const userId = await redis.get(`emlb:email:${normalized}`);
  if (!userId) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const userJson = await redis.get(`emlb:user:${userId}`);
  if (!userJson) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const user = JSON.parse(userJson) as User;
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = signToken({ userId: user.id, email: normalized });
  return res.json({ token, user: { id: user.id, email: normalized, name: user.name } });
}
