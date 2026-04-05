import type { VercelRequest } from '@vercel/node';
import { redis } from './redis';

/**
 * Parse URL path segments after a base path.
 * Handles the __index sentinel from vercel.json rewrites.
 */
export function getPathSegments(req: VercelRequest, base: string): string[] {
  const url = (req.url || '').split('?')[0];
  const after = url.startsWith(base) ? url.slice(base.length) : '';
  const segments = after.split('/').filter(Boolean);
  if (segments.length === 1 && segments[0] === '__index') return [];
  return segments;
}

/** Generate a unique ID (timestamp + random). */
export function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

/** Fetch a user from Redis by ID. */
export async function getUser(userId: string): Promise<User | null> {
  const json = await redis.get(`emlb:user:${userId}`);
  return json ? JSON.parse(json) : null;
}

/** Check if a user is admin. */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  return user?.isAdmin === true;
}

/** Parse JSON from Redis with a fallback. */
export async function getRedisJson<T>(key: string, fallback: T): Promise<T> {
  const json = await redis.get(key);
  return json ? JSON.parse(json) : fallback;
}
