import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../../_lib/redis';
import { requireAuth } from '../../../_lib/auth';
import { cors } from '../../../_lib/cors';

interface TicketComment {
  id: string;
  reactions: Record<string, string[]>;
  [key: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  if (req.method !== 'POST') return res.status(405).end();

  const { id, commentId } = req.query;
  if (typeof id !== 'string' || typeof commentId !== 'string') {
    return res.status(400).json({ error: 'IDs invalides' });
  }

  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji requis' });

  const commentsJson = await redis.get(`emlb:ticket:${id}:comments`);
  const comments: TicketComment[] = commentsJson ? JSON.parse(commentsJson) : [];
  const commentIdx = comments.findIndex((c) => c.id === commentId);

  if (commentIdx === -1) return res.status(404).json({ error: 'Commentaire introuvable' });

  const comment = { ...comments[commentIdx] };
  const reactions = { ...comment.reactions };
  const users = reactions[emoji] ?? [];

  if (users.includes(auth.userId)) {
    reactions[emoji] = users.filter((u: string) => u !== auth.userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    reactions[emoji] = [...users, auth.userId];
  }

  comment.reactions = reactions;
  comments[commentIdx] = comment;
  await redis.set(`emlb:ticket:${id}:comments`, JSON.stringify(comments));

  return res.json({ comment });
}
