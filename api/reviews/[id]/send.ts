import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
import { requireAuth } from '../../_lib/auth';
import { cors } from '../../_lib/cors';
import { sendAuthorRepliedEmail } from '../../_lib/email';

interface ReviewComment {
  id: string;
  status: 'draft' | 'sent' | 'closed';
  isAuthor: boolean;
  updatedAt: string;
  [key: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'id requis' });

  if (req.method === 'POST') {
    const sessionJson = await redis.get(`emlb:review:${id}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    if (session.userId !== auth.userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const commentsJson = await redis.get(`emlb:review:${id}:comments`);
    const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

    // Mark all author draft comments as sent
    let sent = 0;
    for (let i = 0; i < comments.length; i++) {
      if (comments[i].status === 'draft' && comments[i].isAuthor) {
        comments[i].status = 'sent';
        comments[i].updatedAt = new Date().toISOString();
        sent++;
      }
    }

    await redis.set(`emlb:review:${id}:comments`, JSON.stringify(comments));

    // Send email to reader if they have an email
    if (sent > 0 && session.readerEmail) {
      const baseUrl = req.headers.origin || 'https://ecrire-mon-livre.fr';
      await sendAuthorRepliedEmail({
        to: session.readerEmail,
        authorName: session.authorName,
        bookTitle: session.bookTitle,
        commentCount: sent,
        reviewUrl: `${baseUrl}/review/${session.token}`,
      });
    }

    return res.json({ sent });
  }

  return res.status(405).end();
}
