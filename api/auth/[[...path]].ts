import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { hashPassword, comparePassword, signToken, requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isAdmin?: boolean;
  createdAt?: string;
}

// --- Handlers ---

async function handleLogin(req: VercelRequest, res: VercelResponse) {
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

async function handleSignup(req: VercelRequest, res: VercelResponse) {
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
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };

  const memberIdsJson = await redis.get('emlb:member-ids');
  const memberIds: string[] = memberIdsJson ? JSON.parse(memberIdsJson) : [];
  memberIds.push(id);

  await Promise.all([
    redis.set(`emlb:user:${id}`, JSON.stringify(user)),
    redis.set(`emlb:email:${normalized}`, id),
    redis.set('emlb:member-ids', JSON.stringify(memberIds)),
  ]);

  const token = signToken({ userId: id, email: normalized });
  return res.json({ token, user: { id, email: normalized, name: user.name, isAdmin: false } });
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const userJson = await redis.get(`emlb:user:${auth.userId}`);
  if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const user = JSON.parse(userJson) as User;
  return res.json({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin ?? false });
}

// --- Router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const raw = req.query.path;
  const pathSegments: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const route = pathSegments[0] ?? '';

  switch (route) {
    case 'login':
      return handleLogin(req, res);
    case 'signup':
      return handleSignup(req, res);
    case 'me':
      return handleMe(req, res);
    default:
      return res.status(404).json({ error: 'Route introuvable' });
  }
}
