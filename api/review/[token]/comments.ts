import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
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

  const { token } = req.query;
  if (typeof token !== 'string') return res.status(400).json({ error: 'Token requis' });

  // Resolve session from token
  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  if (req.method === 'GET') {
    const commentsJson = await redis.get(`emlb:review:${session.id}:comments`);
    const comments = commentsJson ? JSON.parse(commentsJson) : [];
    return res.json(comments);
  }

  if (req.method === 'POST') {
    // Reader adds a comment
    const body = req.body;
    const commentsJson = await redis.get(`emlb:review:${session.id}:comments`);
    const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

    const newComment: ReviewComment = {
      id: generateId(),
      sessionId: session.id,
      sceneId: body.sceneId,
      isAuthor: false,
      authorLabel: body.authorLabel || session.readerName || 'Relecteur',
      selectedText: body.selectedText || '',
      startOffset: body.startOffset ?? 0,
      endOffset: body.endOffset ?? 0,
      content: body.content,
      status: body.status || 'draft',
      parentId: body.parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    comments.push(newComment);
    await redis.set(`emlb:review:${session.id}:comments`, JSON.stringify(comments));

    // Update comments count
    session.commentsCount = comments.filter((c: ReviewComment) => !c.parentId).length;
    await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));

    return res.json({ comment: newComment });
  }

  return res.status(405).end();
}
