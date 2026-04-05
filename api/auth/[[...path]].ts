import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { hashPassword, comparePassword, signToken, requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';
import { sendPasswordResetEmail } from '../_lib/email';
import { getPathSegments, generateId } from '../_lib/utils';

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isAdmin?: boolean;
  createdAt?: string;
  avatarUrl?: string;
  avatarOffsetY?: number;
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

async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Skip verification if secret not configured
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = await resp.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

async function handleSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, name, captchaToken } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    captchaToken?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (min. 8 caractères)' });
  }

  // Verify Turnstile CAPTCHA
  if (captchaToken) {
    const valid = await verifyCaptcha(captchaToken);
    if (!valid) {
      return res.status(400).json({ error: 'Vérification CAPTCHA échouée. Veuillez réessayer.' });
    }
  } else if (process.env.TURNSTILE_SECRET_KEY) {
    // If secret is configured, captcha is required
    return res.status(400).json({ error: 'Vérification CAPTCHA requise' });
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
  return res.json({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin ?? false, avatarUrl: user.avatarUrl, avatarOffsetY: user.avatarOffsetY });
}

async function handleForgotPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const normalized = email.toLowerCase().trim();

  // Always respond with success to avoid revealing if an email is registered
  const userId = await redis.get(`emlb:email:${normalized}`);
  if (userId) {
    const token = generateId() + generateId();
    await redis.setex(`emlb:reset-token:${token}`, 600, JSON.stringify({ userId, email: normalized }));

    const baseUrl = req.headers.origin || 'https://fabula-mea.com';
    await sendPasswordResetEmail({ to: normalized, resetUrl: `${baseUrl}/reset-password/${token}` });
  }

  return res.json({ ok: true });
}

async function handleResetPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (min. 8 caractères)' });

  const raw = await redis.get(`emlb:reset-token:${token}`);
  if (!raw) return res.status(400).json({ error: 'Lien invalide ou expiré' });

  const { userId } = JSON.parse(raw) as { userId: string; email: string };

  const userJson = await redis.get(`emlb:user:${userId}`);
  if (!userJson) return res.status(400).json({ error: 'Utilisateur introuvable' });

  const user = JSON.parse(userJson) as User;
  user.passwordHash = await hashPassword(password);

  await Promise.all([
    redis.set(`emlb:user:${userId}`, JSON.stringify(user)),
    redis.del(`emlb:reset-token:${token}`),
  ]);

  return res.json({ ok: true });
}

async function handleProfile(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const userJson = await redis.get(`emlb:user:${auth.userId}`);
  if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const user = JSON.parse(userJson) as User;
  const { name, email, avatarUrl, avatarOffsetY } = req.body as { name?: string; email?: string; avatarUrl?: string; avatarOffsetY?: number };

  if (name !== undefined) user.name = name.trim();
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (avatarOffsetY !== undefined) user.avatarOffsetY = avatarOffsetY;

  if (email !== undefined) {
    const newEmail = email.trim().toLowerCase();
    if (newEmail !== user.email) {
      const existingId = await redis.get(`emlb:email:${newEmail}`);
      if (existingId) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
      await redis.del(`emlb:email:${user.email}`);
      await redis.set(`emlb:email:${newEmail}`, user.id);
      user.email = newEmail;
    }
  }

  await redis.set(`emlb:user:${user.id}`, JSON.stringify(user));
  return res.json({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin ?? false, avatarUrl: user.avatarUrl, avatarOffsetY: user.avatarOffsetY });
}

async function handleChangePassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mots de passe requis' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Nouveau mot de passe trop court (min. 8 caractères)' });

  const userJson = await redis.get(`emlb:user:${auth.userId}`);
  if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const user = JSON.parse(userJson) as User;
  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

  user.passwordHash = await hashPassword(newPassword);
  await redis.set(`emlb:user:${user.id}`, JSON.stringify(user));
  return res.json({ ok: true });
}

async function handleDeleteAccount(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const userJson = await redis.get(`emlb:user:${auth.userId}`);
  if (!userJson) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const user = JSON.parse(userJson) as User;

  // Load library to find all books and sagas to clean up
  const libraryJson = await redis.get(`emlb:u:${user.id}:library`);
  const library: { id: string; sagaId?: string }[] = libraryJson ? JSON.parse(libraryJson) : [];

  // Load review session IDs
  const reviewIdsJson = await redis.get(`emlb:u:${user.id}:reviews`);
  const reviewIds: string[] = reviewIdsJson ? JSON.parse(reviewIdsJson) : [];

  // Delete all user books
  const bookDeletes = library.map((b) => redis.del(`emlb:u:${user.id}:book:${b.id}`));

  // Delete all review sessions and their data
  const reviewDeletes: Promise<void>[] = [];
  for (const rid of reviewIds) {
    const sessionJson = await redis.get(`emlb:review:${rid}`);
    if (sessionJson) {
      const session = JSON.parse(sessionJson) as { token?: string };
      if (session.token) {
        reviewDeletes.push(redis.del(`emlb:review:token:${session.token}`));
      }
    }
    reviewDeletes.push(redis.del(`emlb:review:${rid}`));
    reviewDeletes.push(redis.del(`emlb:review:${rid}:comments`));
  }

  // Find unique saga IDs owned by this user
  const sagaIds = [...new Set(library.map((b) => b.sagaId).filter(Boolean))] as string[];
  const sagaDeletes = sagaIds.flatMap((sid) => [
    redis.del(`emlb:saga:${sid}`),
    redis.del(`emlb:saga:${sid}:meta`),
  ]);

  // Delete core user data + all related data
  await Promise.all([
    redis.del(`emlb:user:${user.id}`),
    redis.del(`emlb:email:${user.email}`),
    redis.del(`emlb:u:${user.id}:library`),
    redis.del(`emlb:u:${user.id}:reviews`),
    ...bookDeletes,
    ...reviewDeletes,
    ...sagaDeletes,
  ]);

  // Remove from member-ids index
  const memberIdsJson = await redis.get('emlb:member-ids');
  if (memberIdsJson) {
    const memberIds: string[] = JSON.parse(memberIdsJson);
    const filtered = memberIds.filter((id) => id !== user.id);
    await redis.set('emlb:member-ids', JSON.stringify(filtered));
  }

  return res.json({ ok: true });
}

// --- Router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const pathSegments = getPathSegments(req, '/api/auth');
  const route = pathSegments[0] ?? '';

  switch (route) {
    case 'login':
      return handleLogin(req, res);
    case 'signup':
      return handleSignup(req, res);
    case 'me':
      return handleMe(req, res);
    case 'forgot-password':
      return handleForgotPassword(req, res);
    case 'reset-password':
      return handleResetPassword(req, res);
    case 'profile':
      return handleProfile(req, res);
    case 'change-password':
      return handleChangePassword(req, res);
    case 'account':
      return handleDeleteAccount(req, res);
    default:
      return res.status(404).json({ error: 'Route introuvable' });
  }
}
