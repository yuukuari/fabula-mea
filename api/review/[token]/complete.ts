import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../../_lib/redis';
import { cors } from '../../_lib/cors';
import { sendReviewCompletedEmail } from '../../_lib/email';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const { token } = req.query;
  if (typeof token !== 'string') return res.status(400).json({ error: 'Token requis' });

  if (req.method === 'POST') {
    const sessionJson = await redis.get(`emlb:review:token:${token}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    session.status = 'completed';
    session.completedAt = new Date().toISOString();

    await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));
    await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));

    // Notify author
    if (session.authorEmail) {
      const baseUrl = req.headers.origin || 'https://ecrire-mon-livre.fr';
      await sendReviewCompletedEmail({
        to: session.authorEmail,
        readerName: session.readerName || 'Un relecteur',
        bookTitle: session.bookTitle,
        reviewUrl: `${baseUrl}/reviews`,
      });
    }

    return res.json({ session });
  }

  return res.status(405).end();
}
