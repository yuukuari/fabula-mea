import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';
import { sendTicketCreatedEmail } from '../_lib/email';

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

interface Ticket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'bug' | 'question' | 'improvement';
  module?: string;
  title: string;
  description: string;
  visibility: 'public' | 'private';
  status: 'open' | 'closed_done' | 'closed_duplicate';
  releaseId?: string;
  createdAt: string;
  updatedAt: string;
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

async function isAdmin(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  return user?.isAdmin === true;
}

// --- Handlers ---

/** GET/POST /api/tickets */
async function handleIndex(req: VercelRequest, res: VercelResponse, auth: { userId: string }) {
  if (req.method === 'GET') {
    const ticketsJson = await redis.get('emlb:tickets');
    const allTickets: Ticket[] = ticketsJson ? JSON.parse(ticketsJson) : [];
    const admin = await isAdmin(auth.userId);

    const visible = allTickets.filter(
      (t) => t.visibility === 'public' || t.userId === auth.userId || admin
    );

    const statusChanges: unknown[] = [];
    for (const t of visible) {
      const changesJson = await redis.get(`emlb:ticket:${t.id}:statusChanges`);
      if (changesJson) {
        statusChanges.push(...JSON.parse(changesJson));
      }
    }

    return res.json({ tickets: visible, statusChanges });
  }

  if (req.method === 'POST') {
    const { type, title, description, visibility, module } = req.body;
    if (!type || !title || !description) {
      return res.status(400).json({ error: 'Type, titre et description requis' });
    }

    const user = await getUser(auth.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const ticket: Ticket = {
      id: generateId(),
      userId: auth.userId,
      userName: user.name,
      userEmail: user.email,
      type,
      module: module || undefined,
      title,
      description,
      visibility: visibility ?? 'public',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ticketsJson = await redis.get('emlb:tickets');
    const tickets: Ticket[] = ticketsJson ? JSON.parse(ticketsJson) : [];
    tickets.push(ticket);
    await redis.set('emlb:tickets', JSON.stringify(tickets));

    const baseUrl = req.headers.origin || 'https://fabula-mea.com';
    const ticketUrl = `${baseUrl}/tickets?id=${ticket.id}`;
    const memberIdsJson = await redis.get('emlb:member-ids');
    const memberIds: string[] = memberIdsJson ? JSON.parse(memberIdsJson) : [];
    for (const mid of memberIds) {
      if (mid === auth.userId) continue;
      const adminUser = await getUser(mid);
      if (adminUser?.isAdmin) {
        await sendTicketCreatedEmail({
          to: adminUser.email,
          ticketType: ticket.type,
          ticketModule: ticket.module,
          title: ticket.title,
          description: ticket.description,
          authorName: user.name,
          authorEmail: user.email,
          ticketUrl,
        });
      }
    }

    return res.json({ ticket });
  }

  return res.status(405).end();
}

/** GET/PATCH/DELETE /api/tickets/:id */
async function handleById(req: VercelRequest, res: VercelResponse, auth: { userId: string }, id: string) {
  const ticketsJson = await redis.get('emlb:tickets');
  const tickets: Ticket[] = ticketsJson ? JSON.parse(ticketsJson) : [];
  const ticketIdx = tickets.findIndex((t) => t.id === id);

  if (ticketIdx === -1) return res.status(404).json({ error: 'Ticket introuvable' });
  const ticket = tickets[ticketIdx];

  const user = await getUser(auth.userId);
  const admin = user?.isAdmin === true;

  if (ticket.userId !== auth.userId && !admin && ticket.visibility === 'private') {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  if (req.method === 'GET') {
    const commentsJson = await redis.get(`emlb:ticket:${id}:comments`);
    const comments = commentsJson ? JSON.parse(commentsJson) : [];
    const statusChangesJson = await redis.get(`emlb:ticket:${id}:statusChanges`);
    const statusChanges = statusChangesJson ? JSON.parse(statusChangesJson) : [];
    return res.json({ ticket, comments, statusChanges });
  }

  if (req.method === 'PATCH') {
    if (!admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });

    const { status, releaseId } = req.body;
    const oldStatus = ticket.status;
    const oldReleaseId = ticket.releaseId;

    if (status) ticket.status = status;
    if (releaseId !== undefined) ticket.releaseId = releaseId || undefined;
    ticket.updatedAt = new Date().toISOString();
    tickets[ticketIdx] = ticket;
    await redis.set('emlb:tickets', JSON.stringify(tickets));

    if (status && status !== oldStatus) {
      const changesJson = await redis.get(`emlb:ticket:${id}:statusChanges`);
      const changes = changesJson ? JSON.parse(changesJson) : [];
      changes.push({
        id: generateId(),
        ticketId: id,
        userId: auth.userId,
        userName: user?.name ?? 'Admin',
        type: 'status_change',
        fromStatus: oldStatus,
        toStatus: status,
        createdAt: new Date().toISOString(),
      });
      await redis.set(`emlb:ticket:${id}:statusChanges`, JSON.stringify(changes));
    }

    if (releaseId !== undefined && releaseId !== oldReleaseId) {
      const changesJson = await redis.get(`emlb:ticket:${id}:statusChanges`);
      const changes = changesJson ? JSON.parse(changesJson) : [];
      const releasesJson = await redis.get('emlb:releases');
      const releases = releasesJson ? JSON.parse(releasesJson) : [];
      const release = releases.find((r: any) => r.id === releaseId);
      changes.push({
        id: generateId(),
        ticketId: id,
        userId: auth.userId,
        userName: user?.name ?? 'Admin',
        type: 'release_assign',
        releaseId: releaseId || undefined,
        releaseName: release ? `v${release.version}${release.title ? ' — ' + release.title : ''}` : undefined,
        createdAt: new Date().toISOString(),
      });
      await redis.set(`emlb:ticket:${id}:statusChanges`, JSON.stringify(changes));
    }

    return res.json({ ticket });
  }

  if (req.method === 'DELETE') {
    if (!admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });
    tickets.splice(ticketIdx, 1);
    await redis.set('emlb:tickets', JSON.stringify(tickets));
    await redis.del(`emlb:ticket:${id}:comments`);
    await redis.del(`emlb:ticket:${id}:statusChanges`);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}

/** GET/POST /api/tickets/:id/comments */
async function handleComments(req: VercelRequest, res: VercelResponse, auth: { userId: string }, ticketId: string) {
  const user = await getUser(auth.userId);
  const admin = user?.isAdmin === true;

  if (req.method === 'GET') {
    const commentsJson = await redis.get(`emlb:ticket:${ticketId}:comments`);
    const comments: TicketComment[] = commentsJson ? JSON.parse(commentsJson) : [];
    return res.json({ comments });
  }

  if (req.method === 'POST') {
    if (!admin) return res.status(403).json({ error: 'Seul un administrateur peut commenter' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Contenu requis' });

    const comment: TicketComment = {
      id: generateId(),
      ticketId,
      userId: auth.userId,
      userName: user?.name ?? 'Admin',
      isAdmin: true,
      content: content.trim(),
      reactions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const commentsJson = await redis.get(`emlb:ticket:${ticketId}:comments`);
    const comments: TicketComment[] = commentsJson ? JSON.parse(commentsJson) : [];
    comments.push(comment);
    await redis.set(`emlb:ticket:${ticketId}:comments`, JSON.stringify(comments));

    return res.json({ comment });
  }

  return res.status(405).end();
}

/** DELETE /api/tickets/:id/comments/:commentId */
async function handleCommentById(req: VercelRequest, res: VercelResponse, auth: { userId: string }, ticketId: string, commentId: string) {
  const user = await getUser(auth.userId);
  const admin = user?.isAdmin === true;

  const commentsJson = await redis.get(`emlb:ticket:${ticketId}:comments`);
  const comments: TicketComment[] = commentsJson ? JSON.parse(commentsJson) : [];
  const commentIdx = comments.findIndex((c) => c.id === commentId);

  if (commentIdx === -1) return res.status(404).json({ error: 'Commentaire introuvable' });

  if (req.method === 'DELETE') {
    if (comments[commentIdx].userId !== auth.userId && !admin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    comments.splice(commentIdx, 1);
    await redis.set(`emlb:ticket:${ticketId}:comments`, JSON.stringify(comments));
    return res.json({ ok: true });
  }

  return res.status(405).end();
}

/** POST /api/tickets/:id/comments/:commentId/reaction */
async function handleReaction(req: VercelRequest, res: VercelResponse, auth: { userId: string }, ticketId: string, commentId: string) {
  if (req.method !== 'POST') return res.status(405).end();

  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji requis' });

  const commentsJson = await redis.get(`emlb:ticket:${ticketId}:comments`);
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
  await redis.set(`emlb:ticket:${ticketId}:comments`, JSON.stringify(comments));

  return res.json({ comment });
}

// --- Router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const pathSegments = getPathSegments(req, '/api/tickets');
  // Query params for sub-actions (Vercel only routes 1 path segment)
  const action = req.query.action as string | undefined;
  const cid = req.query.cid as string | undefined;

  // GET|POST /api/tickets
  if (pathSegments.length === 0) {
    return handleIndex(req, res, auth);
  }

  const id = pathSegments[0];

  if (pathSegments.length === 1) {
    // POST /api/tickets/ID?action=comment           → add comment
    // PATCH|DELETE /api/tickets/ID?action=comment&cid= → update/delete comment
    if (action === 'comment') {
      if (cid) return handleCommentById(req, res, auth, id, cid);
      return handleComments(req, res, auth, id);
    }
    // POST /api/tickets/ID?action=reaction&cid=     → toggle reaction
    if (action === 'reaction' && cid) {
      return handleReaction(req, res, auth, id, cid);
    }

    // GET|PATCH|DELETE /api/tickets/ID
    return handleById(req, res, auth, id);
  }

  return res.status(404).json({ error: 'Route introuvable' });
}
