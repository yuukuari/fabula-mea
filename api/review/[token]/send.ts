import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
import { cors } from '../../_lib/cors';
import { sendCommentsNotificationEmail } from '../../_lib/email';

interface ReviewComment {
  id: string;
  status: 'draft' | 'sent' | 'closed';
  parentId?: string;
  updatedAt: string;
  [key: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const { token } = req.query;
  if (typeof token !== 'string') return res.status(400).json({ error: 'Token requis' });

  if (req.method === 'POST') {
    const sessionJson = await redis.get(`emlb:review:token:${token}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    const commentsJson = await redis.get(`emlb:review:${session.id}:comments`);
    const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

    // Mark all draft comments as sent
    let sent = 0;
    for (let i = 0; i < comments.length; i++) {
      if (comments[i].status === 'draft') {
        comments[i].status = 'sent';
        comments[i].updatedAt = new Date().toISOString();
        sent++;
      }
    }

    await redis.set(`emlb:review:${session.id}:comments`, JSON.stringify(comments));

    // Send email to author
    if (sent > 0 && session.authorEmail) {
      const baseUrl = req.headers.origin || 'https://ecrire-mon-livre.fr';
      await sendCommentsNotificationEmail({
        to: session.authorEmail,
        readerName: session.readerName || 'Un relecteur',
        bookTitle: session.bookTitle,
        commentCount: sent,
        reviewUrl: `${baseUrl}/reviews`,
      });
    }

    return res.json({ sent });
  }

  return res.status(405).end();
}
