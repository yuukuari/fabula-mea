import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../../_lib/redis';
import { cors } from '../../../_lib/cors';

interface ReviewComment {
  id: string;
  sessionId: string;
  status: 'draft' | 'sent' | 'closed';
  parentId?: string;
  updatedAt: string;
  [key: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const { token, commentId } = req.query;
  if (typeof token !== 'string' || typeof commentId !== 'string') {
    return res.status(400).json({ error: 'token et commentId requis' });
  }

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  const commentsJson = await redis.get(`emlb:review:${session.id}:comments`);
  const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

  if (req.method === 'PATCH') {
    const idx = comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Commentaire introuvable' });

    const { content, status } = req.body;
    if (content !== undefined) comments[idx].content = content;
    if (status !== undefined) comments[idx].status = status;
    comments[idx].updatedAt = new Date().toISOString();

    await redis.set(`emlb:review:${session.id}:comments`, JSON.stringify(comments));
    return res.json({ comment: comments[idx] });
  }

  if (req.method === 'DELETE') {
    const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
    await redis.set(`emlb:review:${session.id}:comments`, JSON.stringify(filtered));

    session.commentsCount = filtered.filter((c: ReviewComment) => !c.parentId).length;
    await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));

    return res.json({ ok: true });
  }

  return res.status(405).end();
}
