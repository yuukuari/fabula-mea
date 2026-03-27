import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { hashPassword, signToken } from '../_lib/auth';
import { cors } from '../_lib/cors';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (min. 8 caractères)' });
  }

  const normalized = email.toLowerCase().trim();
  const existingId = await redis.get(`emlb:email:${normalized}`);
  if (existingId) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }

  const id = generateId();
  const passwordHash = await hashPassword(password);
  const user: User = {
    id,
    email: normalized,
    name: name?.trim() || normalized.split('@')[0],
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    redis.set(`emlb:user:${id}`, JSON.stringify(user)),
    redis.set(`emlb:email:${normalized}`, id),
  ]);

  const token = signToken({ userId: id, email: normalized });
  return res.json({ token, user: { id, email: normalized, name: user.name } });
}
