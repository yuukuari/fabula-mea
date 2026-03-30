import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
import { requireAuth } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
  content: string;
  reactions: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

async function getUser(userId: string): Promise<User | null> {
  const json = await redis.get(`emlb:user:${userId}`);
  return json ? JSON.parse(json) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.query; // ticketId
  if (typeof id !== 'string') return res.status(400).json({ error: 'ID invalide' });

  const user = await getUser(auth.userId);
  const admin = user?.isAdmin === true;

  if (req.method === 'GET') {
    const commentsJson = await redis.get(`emlb:ticket:${id}:comments`);
    const comments: TicketComment[] = commentsJson ? JSON.parse(commentsJson) : [];
    return res.json({ comments });
  }

  if (req.method === 'POST') {
    // Only admin can comment
    if (!admin) return res.status(403).json({ error: 'Seul un administrateur peut commenter' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Contenu requis' });

    const comment: TicketComment = {
      id: generateId(),
      ticketId: id,
      userId: auth.userId,
      userName: user?.name ?? 'Admin',
      isAdmin: true,
      content: content.trim(),
      reactions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const commentsJson = await redis.get(`emlb:ticket:${id}:comments`);
    const comments: TicketComment[] = commentsJson ? JSON.parse(commentsJson) : [];
    comments.push(comment);
    await redis.set(`emlb:ticket:${id}:comments`, JSON.stringify(comments));

    return res.json({ comment });
  }

  return res.status(405).end();
}
