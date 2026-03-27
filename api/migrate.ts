import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from './_lib/redis';
import { requireAuth } from './_lib/auth';
import { cors } from './_lib/cors';

/**
 * POST /api/migrate
 * Migrates anonymous local data (from localStorage) to the authenticated user's account.
 * Called once after the user creates or logs into their account for the first time
 * on a device that already had data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { library, books } = req.body as {
    library?: unknown[];
    books?: { id: string; data: unknown }[];
  };

  const ops: Promise<void>[] = [];

  if (library && library.length > 0) {
    // Check if user already has cloud data — don't overwrite if they do
    const existing = await redis.get(`emlb:u:${auth.userId}:library`);
    if (!existing) {
      ops.push(redis.set(`emlb:u:${auth.userId}:library`, JSON.stringify(library)));
    }
  }

  for (const { id, data } of books ?? []) {
    const existing = await redis.get(`emlb:u:${auth.userId}:book:${id}`);
    if (!existing) {
      ops.push(redis.set(`emlb:u:${auth.userId}:book:${id}`, JSON.stringify(data)));
    }
  }

  await Promise.all(ops);
  return res.json({ ok: true, migrated: books?.length ?? 0 });
}
