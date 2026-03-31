import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { cors } from '../_lib/cors';
import { sendCommentsNotificationEmail, sendReviewCompletedEmail } from '../_lib/email';

function getPathSegments(req: VercelRequest, base: string): string[] {
  const url = (req.url || '').split('?')[0];
  const after = url.startsWith(base) ? url.slice(base.length) : '';
  return after.split('/').filter(Boolean);
}

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

// --- Handlers ---

/** GET /api/review/:token */
async function handleGetSession(req: VercelRequest, res: VercelResponse, token: string) {
  if (req.method !== 'GET') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);
  return res.json({ session });
}

/** POST /api/review/:token/start */
async function handleStart(req: VercelRequest, res: VercelResponse, token: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  const { readerName } = req.body;
  if (!readerName) return res.status(400).json({ error: 'Nom du relecteur requis' });

  session.readerName = readerName;
  session.status = 'in_progress';
  session.startedAt = new Date().toISOString();

  await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));
  await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));

  return res.json({ session });
}

/** POST /api/review/:token/complete */
async function handleComplete(req: VercelRequest, res: VercelResponse, token: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  session.status = 'completed';
  session.completedAt = new Date().toISOString();

  await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));
  await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));

  if (session.authorEmail) {
    const baseUrl = req.headers.origin || 'https://ecrire-mon-livre.fr';
    await sendReviewCompletedEmail({
      to: session.authorEmail,
      readerName: session.readerName || 'Un relecteur',
      bookTitle: session.bookTitle,
      reviewUrl: `${baseUrl}/reviews/${session.id}`,
    });
  }

  return res.json({ session });
}

/** POST /api/review/:token/send */
async function handleSend(req: VercelRequest, res: VercelResponse, token: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  const commentsJson = await redis.get(`emlb:review:${session.id}:comments`);
  const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

  let sent = 0;
  for (let i = 0; i < comments.length; i++) {
    if (comments[i].status === 'draft') {
      comments[i].status = 'sent';
      comments[i].updatedAt = new Date().toISOString();
      sent++;
    }
  }

  await redis.set(`emlb:review:${session.id}:comments`, JSON.stringify(comments));

  if (sent > 0 && session.authorEmail) {
    const baseUrl = req.headers.origin || 'https://ecrire-mon-livre.fr';
    await sendCommentsNotificationEmail({
      to: session.authorEmail,
      readerName: session.readerName || 'Un relecteur',
      bookTitle: session.bookTitle,
      commentCount: sent,
      reviewUrl: `${baseUrl}/reviews/${session.id}`,
    });
  }

  return res.json({ sent });
}

/** GET/POST /api/review/:token/comments */
async function handleComments(req: VercelRequest, res: VercelResponse, token: string) {
  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  if (req.method === 'GET') {
    const commentsJson = await redis.get(`emlb:review:${session.id}:comments`);
    const comments = commentsJson ? JSON.parse(commentsJson) : [];
    return res.json(comments);
  }

  if (req.method === 'POST') {
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

    session.commentsCount = comments.filter((c: ReviewComment) => !c.parentId).length;
    await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));

    return res.json({ comment: newComment });
  }

  return res.status(405).end();
}

/** PATCH/DELETE /api/review/:token/comments/:commentId */
async function handleCommentById(req: VercelRequest, res: VercelResponse, token: string, commentId: string) {
  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  const commentsJson = await redis.get(`emlb:review:${session.id}:comments`);
  const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

  if (req.method === 'PATCH') {
    const idx = comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Commentaire introuvable' });

    const { content, status } = req.body;
    if (content !== undefined) comments[idx].content = content;
    if (status !== undefined) comments[idx].status = status;
    comments[idx].updatedAt = new Date().toISOString();

    await redis.set(`emlb:review:${session.id}:comments`, JSON.stringify(comments));
    return res.json({ comment: comments[idx] });
  }

  if (req.method === 'DELETE') {
    const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
    await redis.set(`emlb:review:${session.id}:comments`, JSON.stringify(filtered));

    session.commentsCount = filtered.filter((c: ReviewComment) => !c.parentId).length;
    await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));

    return res.json({ ok: true });
  }

  return res.status(405).end();
}

// --- Router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const pathSegments = getPathSegments(req, '/api/review');

  if (pathSegments.length === 0) {
    return res.status(404).json({ error: 'Token requis' });
  }

  const token = pathSegments[0];

  // /api/review/:token
  if (pathSegments.length === 1) {
    return handleGetSession(req, res, token);
  }

  const action = pathSegments[1];

  // /api/review/:token/start
  if (action === 'start' && pathSegments.length === 2) {
    return handleStart(req, res, token);
  }

  // /api/review/:token/complete
  if (action === 'complete' && pathSegments.length === 2) {
    return handleComplete(req, res, token);
  }

  // /api/review/:token/send
  if (action === 'send' && pathSegments.length === 2) {
    return handleSend(req, res, token);
  }

  // /api/review/:token/comments
  if (action === 'comments' && pathSegments.length === 2) {
    return handleComments(req, res, token);
  }

  // /api/review/:token/comments/:commentId
  if (action === 'comments' && pathSegments.length === 3) {
    return handleCommentById(req, res, token, pathSegments[2]);
  }

  return res.status(404).json({ error: 'Route introuvable' });
}
