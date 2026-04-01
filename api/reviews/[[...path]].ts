import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';
import { sendReviewInviteEmail, sendAuthorRepliedEmail, sendCommentsNotificationEmail, sendReviewCompletedEmail } from '../_lib/email';

function getPathSegments(req: VercelRequest, base: string): string[] {
  const url = (req.url || '').split('?')[0];
  const after = url.startsWith(base) ? url.slice(base.length) : '';
  const segments = after.split('/').filter(Boolean);
  // __index is a sentinel from vercel.json rewrites for bare routes
  if (segments.length === 1 && segments[0] === '__index') return [];
  return segments;
}

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
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

async function getUser(userId: string): Promise<User | null> {
  const json = await redis.get(`emlb:user:${userId}`);
  return json ? JSON.parse(json) : null;
}

// ============================================================
// AUTHOR HANDLERS (require auth)
// ============================================================

/** GET/POST /api/reviews */
async function handleIndex(req: VercelRequest, res: VercelResponse, auth: { userId: string }) {
  if (req.method === 'GET') {
    const idsJson = await redis.get(`emlb:u:${auth.userId}:reviews`);
    const sessionIds: string[] = idsJson ? JSON.parse(idsJson) : [];
    const sessions: unknown[] = [];

    for (const sid of sessionIds) {
      const sJson = await redis.get(`emlb:review:${sid}`);
      if (sJson) {
        const session = JSON.parse(sJson);
        const commentsJson = await redis.get(`emlb:review:${sid}:comments`);
        const comments: Array<{ parentId?: string; status: string; isAuthor: boolean }> = commentsJson ? JSON.parse(commentsJson) : [];
        session.pendingCommentsCount = comments.filter((c) => !c.parentId && c.status === 'sent' && !c.isAuthor).length;
        sessions.push(session);
      }
    }

    return res.json(sessions);
  }

  if (req.method === 'POST') {
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

    await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));
    await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));

    const idsJson = await redis.get(`emlb:u:${auth.userId}:reviews`);
    const ids: string[] = idsJson ? JSON.parse(idsJson) : [];
    ids.push(session.id);
    await redis.set(`emlb:u:${auth.userId}:reviews`, JSON.stringify(ids));

    if (readerEmail) {
      const baseUrl = req.headers.origin || 'https://fabula-mea.com';
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

/** GET/PATCH/DELETE /api/reviews/:id */
async function handleById(req: VercelRequest, res: VercelResponse, auth: { userId: string }, id: string) {
  if (req.method === 'GET') {
    const sessionJson = await redis.get(`emlb:review:${id}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    if (session.userId !== auth.userId) {
      return res.status(403).json({ error: 'Acces refuse' });
    }

    const commentsJson = await redis.get(`emlb:review:${id}:comments`);
    const comments = commentsJson ? JSON.parse(commentsJson) : [];

    session.pendingCommentsCount = comments.filter((c: { parentId?: string; status: string; isAuthor: boolean }) => !c.parentId && c.status === 'sent' && !c.isAuthor).length;

    return res.json({ session, comments });
  }

  if (req.method === 'PATCH') {
    const sessionJson = await redis.get(`emlb:review:${id}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    if (session.userId !== auth.userId) {
      return res.status(403).json({ error: 'Acces refuse' });
    }

    const { status } = req.body;
    if (status === 'closed') {
      session.status = 'closed';
      session.closedAt = new Date().toISOString();
    }

    await redis.set(`emlb:review:${id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${session.token}`, JSON.stringify(session));

    return res.json({ session });
  }

  if (req.method === 'DELETE') {
    const sessionJson = await redis.get(`emlb:review:${id}`);
    if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
    const session = JSON.parse(sessionJson);

    if (session.userId !== auth.userId) {
      return res.status(403).json({ error: 'Acces refuse' });
    }

    await redis.del(`emlb:review:${id}`);
    await redis.del(`emlb:review:token:${session.token}`);
    await redis.del(`emlb:review:${id}:comments`);

    const idsJson = await redis.get(`emlb:u:${auth.userId}:reviews`);
    const ids: string[] = idsJson ? JSON.parse(idsJson) : [];
    await redis.set(`emlb:u:${auth.userId}:reviews`, JSON.stringify(ids.filter((s) => s !== id)));

    return res.json({ ok: true });
  }

  return res.status(405).end();
}

/** POST /api/reviews/:id/comments (author) */
async function handleAuthorComments(req: VercelRequest, res: VercelResponse, auth: { userId: string }, id: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:${id}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);
  if (session.userId !== auth.userId) return res.status(403).json({ error: 'Acces refuse' });

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

  session.commentsCount = comments.filter((c: ReviewComment) => !c.parentId).length;
  await redis.set(`emlb:review:${id}`, JSON.stringify(session));
  await redis.set(`emlb:review:token:${session.token}`, JSON.stringify(session));

  return res.json({ comment: newComment });
}

/** PATCH/DELETE /api/reviews/:id/comments/:commentId (author) */
async function handleAuthorCommentById(req: VercelRequest, res: VercelResponse, auth: { userId: string }, id: string, commentId: string) {
  const sessionJson = await redis.get(`emlb:review:${id}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);
  if (session.userId !== auth.userId) return res.status(403).json({ error: 'Acces refuse' });

  const commentsJson = await redis.get(`emlb:review:${id}:comments`);
  const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

  if (req.method === 'PATCH') {
    const idx = comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Commentaire introuvable' });

    const { content, status } = req.body;
    if (content !== undefined) comments[idx].content = content;
    if (status !== undefined) comments[idx].status = status;
    comments[idx].updatedAt = new Date().toISOString();

    await redis.set(`emlb:review:${id}:comments`, JSON.stringify(comments));
    return res.json({ comment: comments[idx] });
  }

  if (req.method === 'DELETE') {
    const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
    await redis.set(`emlb:review:${id}:comments`, JSON.stringify(filtered));

    session.commentsCount = filtered.filter((c: ReviewComment) => !c.parentId).length;
    await redis.set(`emlb:review:${id}`, JSON.stringify(session));
    await redis.set(`emlb:review:token:${session.token}`, JSON.stringify(session));

    return res.json({ ok: true });
  }

  return res.status(405).end();
}

/** POST /api/reviews/:id/send (author) */
async function handleAuthorSend(req: VercelRequest, res: VercelResponse, auth: { userId: string }, id: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:${id}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  if (session.userId !== auth.userId) {
    return res.status(403).json({ error: 'Acces refuse' });
  }

  const commentsJson = await redis.get(`emlb:review:${id}:comments`);
  const comments: ReviewComment[] = commentsJson ? JSON.parse(commentsJson) : [];

  let sent = 0;
  for (let i = 0; i < comments.length; i++) {
    if (comments[i].status === 'draft' && comments[i].isAuthor) {
      comments[i].status = 'sent';
      comments[i].updatedAt = new Date().toISOString();
      sent++;
    }
  }

  await redis.set(`emlb:review:${id}:comments`, JSON.stringify(comments));

  if (sent > 0 && session.readerEmail) {
    const baseUrl = req.headers.origin || 'https://fabula-mea.com';
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

// ============================================================
// READER HANDLERS (no auth — accessed by token)
// ============================================================

/** GET /api/reviews/reader/:token */
async function handleReaderGetSession(req: VercelRequest, res: VercelResponse, token: string) {
  if (req.method !== 'GET') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);
  return res.json({ session });
}

/** POST /api/reviews/reader/:token/start */
async function handleReaderStart(req: VercelRequest, res: VercelResponse, token: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  const { readerName } = (req.body || {}) as { readerName?: string };
  if (!readerName) return res.status(400).json({ error: 'Nom du relecteur requis' });

  session.readerName = readerName;
  session.status = 'in_progress';
  session.startedAt = new Date().toISOString();

  await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));
  await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));

  return res.json({ session });
}

/** POST /api/reviews/reader/:token/complete */
async function handleReaderComplete(req: VercelRequest, res: VercelResponse, token: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionJson = await redis.get(`emlb:review:token:${token}`);
  if (!sessionJson) return res.status(404).json({ error: 'Session introuvable' });
  const session = JSON.parse(sessionJson);

  session.status = 'completed';
  session.completedAt = new Date().toISOString();

  await redis.set(`emlb:review:token:${token}`, JSON.stringify(session));
  await redis.set(`emlb:review:${session.id}`, JSON.stringify(session));

  if (session.authorEmail) {
    const baseUrl = req.headers.origin || 'https://fabula-mea.com';
    await sendReviewCompletedEmail({
      to: session.authorEmail,
      readerName: session.readerName || 'Un relecteur',
      bookTitle: session.bookTitle,
      reviewUrl: `${baseUrl}/reviews/${session.id}`,
    });
  }

  return res.json({ session });
}

/** POST /api/reviews/reader/:token/send */
async function handleReaderSend(req: VercelRequest, res: VercelResponse, token: string) {
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
    const baseUrl = req.headers.origin || 'https://fabula-mea.com';
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

/** GET/POST /api/reviews/reader/:token/comments */
async function handleReaderComments(req: VercelRequest, res: VercelResponse, token: string) {
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

/** PATCH/DELETE /api/reviews/reader/:token/comments/:commentId */
async function handleReaderCommentById(req: VercelRequest, res: VercelResponse, token: string, commentId: string) {
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

// ============================================================
// ROUTER
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const pathSegments = getPathSegments(req, '/api/reviews');
  const route = pathSegments[0] ?? '';

  // ── Reader routes (NO AUTH) — flat: /api/reviews/reader-xxx/:token ──

  // GET /api/reviews/reader/:token
  if (route === 'reader' && pathSegments.length === 2) {
    return handleReaderGetSession(req, res, pathSegments[1]);
  }
  // POST /api/reviews/reader-start/:token
  if (route === 'reader-start' && pathSegments.length === 2) {
    return handleReaderStart(req, res, pathSegments[1]);
  }
  // POST /api/reviews/reader-complete/:token
  if (route === 'reader-complete' && pathSegments.length === 2) {
    return handleReaderComplete(req, res, pathSegments[1]);
  }
  // POST /api/reviews/reader-send/:token
  if (route === 'reader-send' && pathSegments.length === 2) {
    return handleReaderSend(req, res, pathSegments[1]);
  }
  // GET|POST /api/reviews/reader-comments/:token
  if (route === 'reader-comments' && pathSegments.length === 2) {
    return handleReaderComments(req, res, pathSegments[1]);
  }
  // PATCH|DELETE /api/reviews/reader-comment/:token/:commentId
  if (route === 'reader-comment' && pathSegments.length === 3) {
    return handleReaderCommentById(req, res, pathSegments[1], pathSegments[2]);
  }

  // ── Author routes (AUTH REQUIRED) ──
  const auth = requireAuth(req, res);
  if (!auth) return;

  // GET|POST /api/reviews
  if (pathSegments.length === 0) {
    return handleIndex(req, res, auth);
  }

  const id = pathSegments[0];

  // GET|PATCH|DELETE /api/reviews/:id
  if (pathSegments.length === 1) {
    return handleById(req, res, auth, id);
  }

  const action = pathSegments[1];

  // POST /api/reviews/:id/comments
  if (action === 'comments' && pathSegments.length === 2) {
    return handleAuthorComments(req, res, auth, id);
  }
  // PATCH|DELETE /api/reviews/:id/comments/:commentId
  if (action === 'comments' && pathSegments.length === 3) {
    return handleAuthorCommentById(req, res, auth, id, pathSegments[2]);
  }
  // POST /api/reviews/:id/send
  if (action === 'send' && pathSegments.length === 2) {
    return handleAuthorSend(req, res, auth, id);
  }

  return res.status(404).json({ error: 'Route introuvable' });
}
