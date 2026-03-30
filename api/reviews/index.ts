import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';
import { sendReviewInviteEmail } from '../_lib/email';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

async function getUser(userId: string): Promise<User | null> {
  const json = await redis.get(`emlb:user:${userId}`);
  return json ? JSON.parse(json) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    // List all review sessions for this author
    const idsJson = await redis.get(`emlb:u:${auth.userId}:reviews`);
    const sessionIds: string[] = idsJson ? JSON.parse(idsJson) : [];
    const sessions: unknown[] = [];

    for (const sid of sessionIds) {
      const sJson = await redis.get(`emlb:review:${sid}`);
      if (sJson) {
        const session = JSON.parse(sJson);
        // Compute pendingCommentsCount from actual comments
        const commentsJson = await redis.get(`emlb:review:${sid}:comments`);
        const comments: Array<{ parentId?: string; status: string; isAuthor: boolean }> = commentsJson ? JSON.parse(commentsJson) : [];
        session.pendingCommentsCount = comments.filter((c: { parentId?: string; status: string; isAuthor: boolean }) => !c.parentId && c.status === 'sent' && !c.isAuthor).length;
        sessions.push(session);
      }
    }

    return res.json(sessions);
  }

  if (req.method === 'POST') {
    // Create a new review session
    const { bookId, bookTitle, authorName, authorEmail, readerEmail, snapshot } = req.body;
    if (!bookId || !snapshot) {
      return res.status(400).json({ error: 'bookId et snapshot requis' });
    }

    const user = await getUser(auth.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const token = generateId() + generateId();
    const session = {
      id: generateId(),
      bookId,
      bookTitle: bookTitle || 'Sans titre',
      authorName: authorName || user.name,
      authorEmail: authorEmail || user.email,
      userId: auth.userId,
      token,
      readerEmail: readerEmail || undefined,
      status: 'pending',
      snapshot,
      commentsCount: 0,
      pendingCommentsCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Store by token & by id
    await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));
    await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));

    // Add to author's session list
    const idsJson = await redis.get(`emlb:u:${auth.userId}:reviews`);
    const ids: string[] = idsJson ? JSON.parse(idsJson) : [];
    ids.push(session.id);
    await redis.set(`emlb:u:${auth.userId}:reviews`, JSON.stringify(ids));

    // Send invite email if readerEmail provided
    if (readerEmail) {
      const baseUrl = req.headers.origin || 'https://ecrire-mon-livre.fr';
      await sendReviewInviteEmail({
        to: readerEmail,
        authorName: session.authorName,
        bookTitle: session.bookTitle,
        reviewUrl: `${baseUrl}/review/${token}`,
      });
    }

    return res.json({ session });
  }

  return res.status(405).end();
}
