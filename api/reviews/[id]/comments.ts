import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
import { requireAuth } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

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

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'id requis' });

  // Verify ownership
  const sessionJson = await redis.get(`emlb:review:${id}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);
  if (session.userId !== auth.userId) return res.status(403).json({ error: 'Accès refusé' });

  if (req.method === 'POST') {
    // Author adds a comment (reply)
    const body = req.body;
    const commentsJson = await redis.get(`emlb:review:${id}:comments`);
    const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

    const newComment: ReviewComment = {
      id: generateId(),
      sessionId: id,
      sceneId: body.sceneId,
      isAuthor: true,
      authorLabel: body.authorLabel || session.authorName,
      selectedText: body.selectedText || '',
      startOffset: body.startOffset ?? 0,
      endOffset: body.endOffset ?? 0,
      content: body.content,
      status: body.status || 'sent',
      parentId: body.parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    comments.push(newComment);
    await redis.set(`emlb:review:${id}:comments`, JSON.stringify(comments));

    // Update comments count
    session.commentsCount = comments.filter((c: ReviewComment) => !c.parentId).length;
    await redis.set(`emlb:review:${id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${session.token}`, JSON.stringify(session));

    return res.json({ comment: newComment });
  }

  return res.status(405).end();
}
