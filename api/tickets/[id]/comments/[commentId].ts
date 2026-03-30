import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../../_lib/redis';
import { requireAuth } from '../../../_lib/auth';
import { cors } from '../../../_lib/cors';

interface User {
  id: string;
  isAdmin?: boolean;
}

interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  reactions: Record<string, string[]>;
  [key: string]: unknown;
}

async function getUser(userId: string): Promise<User | null> {
  const json = await redis.get(`emlb:user:${userId}`);
  return json ? JSON.parse(json) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id, commentId } = req.query; // ticketId, commentId
  if (typeof id !== 'string' || typeof commentId !== 'string') {
    return res.status(400).json({ error: 'IDs invalides' });
  }

  const user = await getUser(auth.userId);
  const admin = user?.isAdmin === true;

  const commentsJson = await redis.get(`emlb:ticket:${id}:comments`);
  const comments: TicketComment[] = commentsJson ? JSON.parse(commentsJson) : [];
  const commentIdx = comments.findIndex((c) => c.id === commentId);

  if (commentIdx === -1) return res.status(404).json({ error: 'Commentaire introuvable' });

  if (req.method === 'DELETE') {
    // Own comment or admin
    if (comments[commentIdx].userId !== auth.userId && !admin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    comments.splice(commentIdx, 1);
    await redis.set(`emlb:ticket:${id}:comments`, JSON.stringify(comments));
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
