import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export const hashPassword = (pwd: string): Promise<string> => bcrypt.hash(pwd, 10);
export const comparePassword = (pwd: string, hash: string): Promise<boolean> => bcrypt.compare(pwd, hash);

/** Extracts & verifies the Bearer token from the request. Returns null without responding. */
export function getAuthUser(req: VercelRequest): TokenPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return verifyToken(auth.slice(7));
  } catch {
    return null;
  }
}

/** Extracts & verifies the Bearer token, or responds 401 and returns null. */
export function requireAuth(req: VercelRequest, res: VercelResponse): TokenPayload | null {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }
  return user;
}
