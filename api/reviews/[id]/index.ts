import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
import { requireAuth } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'id requis' });

  if (req.method === 'GET') {
    const sessionJson = await redis.get(`emlb:review:${id}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    // Verify ownership
    if (session.userId !== auth.userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const commentsJson = await redis.get(`emlb:review:${id}:comments`);
    const comments = commentsJson ? JSON.parse(commentsJson) : [];

    // Compute pendingCommentsCount from actual comments
    session.pendingCommentsCount = comments.filter((c: { parentId?: string; status: string; isAuthor: boolean }) => !c.parentId && c.status === 'sent' && !c.isAuthor).length;

    return res.json({ session, comments });
  }

  if (req.method === 'PATCH') {
    const sessionJson = await redis.get(`emlb:review:${id}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    if (session.userId !== auth.userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { status } = req.body;
    if (status === 'closed') {
      session.status = 'closed';
      session.closedAt = new Date().toISOString();
    }

    await redis.set(`emlb:review:${id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${session.token}`, JSON.stringify(session));

    return res.json({ session });
  }

  if (req.method === 'DELETE') {
    const sessionJson = await redis.get(`emlb:review:${id}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    if (session.userId !== auth.userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Delete all related data
    await redis.del(`emlb:review:${id}`);
    await redis.del(`emlb:review:token:${session.token}`);
    await redis.del(`emlb:review:${id}:comments`);

    // Remove from author's list
    const idsJson = await redis.get(`emlb:u:${auth.userId}:reviews`);
    const ids: string[] = idsJson ? JSON.parse(idsJson) : [];
    await redis.set(`emlb:u:${auth.userId}:reviews`, JSON.stringify(ids.filter((s) => s !== id)));

    return res.json({ ok: true });
  }

  return res.status(405).end();
}
