import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface Ticket {
  id: string;
  userId: string;
  status: 'open' | 'closed_done' | 'closed_duplicate';
  releaseId?: string;
  updatedAt: string;
  [key: string]: unknown;
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

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'ID invalide' });

  const ticketsJson = await redis.get('emlb:tickets');
  const tickets: Ticket[] = ticketsJson ? JSON.parse(ticketsJson) : [];
  const ticketIdx = tickets.findIndex((t) => t.id === id);

  if (ticketIdx === -1) return res.status(404).json({ error: 'Ticket introuvable' });
  const ticket = tickets[ticketIdx];

  const user = await getUser(auth.userId);
  const admin = user?.isAdmin === true;

  // Check visibility
  if (ticket.userId !== auth.userId && !admin && (ticket as { visibility?: string }).visibility === 'private') {
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

    if (status) ticket.status = status;
    if (releaseId !== undefined) ticket.releaseId = releaseId || undefined;
    ticket.updatedAt = new Date().toISOString();
    tickets[ticketIdx] = ticket;
    await redis.set('emlb:tickets', JSON.stringify(tickets));

    // Add status change log
    if (status && status !== oldStatus) {
      const changesJson = await redis.get(`emlb:ticket:${id}:statusChanges`);
      const changes = changesJson ? JSON.parse(changesJson) : [];
      changes.push({
        id: generateId(),
        ticketId: id,
        userId: auth.userId,
        userName: user?.name ?? 'Admin',
        fromStatus: oldStatus,
        toStatus: status,
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
