import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../../_lib/redis';
import { requireAuth } from '../../../_lib/auth';
import { cors } from '../../../_lib/cors';

interface ReviewComment {
  id: string;
  sessionId: string;
  sceneId: string;
  isAuthor: boolean;
  authorLabel: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  content: string;
  status: 'draft' | 'sent' | 'closed';
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id, commentId } = req.query;
  if (typeof id !== 'string' || typeof commentId !== 'string') {
    return res.status(400).json({ error: 'id et commentId requis' });
  }

  // Verify ownership
  const sessionJson = await redis.get(`emlb:review:${id}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);
  if (session.userId !== auth.userId) return res.status(403).json({ error: 'Accès refusé' });

  const commentsJson = await redis.get(`emlb:review:${id}:comments`);
  const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

  if (req.method === 'PATCH') {
    // Update comment (content or status — author can close)
    const idx = comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Commentaire introuvable' });

    const { content, status } = req.body;
    if (content !== undefined) comments[idx].content = content;
    if (status !== undefined) comments[idx].status = status;
    comments[idx].updatedAt = new Date().toISOString();

    await redis.set(`emlb:review:${id}:comments`, JSON.stringify(comments));
    return res.json({ comment: comments[idx] });
  }

  if (req.method === 'DELETE') {
    const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
    await redis.set(`emlb:review:${id}:comments`, JSON.stringify(filtered));

    // Update comments count
    session.commentsCount = filtered.filter((c: ReviewComment) => !c.parentId).length;
    await redis.set(`emlb:review:${id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${session.token}`, JSON.stringify(session));

    return res.json({ ok: true });
  }

  return res.status(405).end();
}
