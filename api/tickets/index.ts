import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth, getAuthUser } from '../_lib/auth';
import { cors } from '../_lib/cors';
import { sendTicketCreatedEmail } from '../_lib/email';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface Ticket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'bug' | 'question' | 'improvement';
  module?: 'auth' | 'characters' | 'places' | 'chapters' | 'timeline' | 'progress' | 'world' | 'maps' | 'notes' | 'reviews' | 'settings' | 'export' | 'other';
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

async function getUser(userId: string): Promise<User | null> {
  const json = await redis.get(`emlb:user:${userId}`);
  return json ? JSON.parse(json) : null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  return user?.isAdmin === true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    // List tickets visible to this user
    const ticketsJson = await redis.get('emlb:tickets');
    const allTickets: Ticket[] = ticketsJson ? JSON.parse(ticketsJson) : [];
    const admin = await isAdmin(auth.userId);

    const visible = allTickets.filter(
      (t) => t.visibility === 'public' || t.userId === auth.userId || admin
    );

    // Gather status changes
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
    // Create ticket
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

    // Send email notification to all admins
    const baseUrl = req.headers.origin || 'https://ecrire-mon-livre.fr';
    const ticketUrl = `${baseUrl}/tickets?id=${ticket.id}`;
    const memberIdsJson = await redis.get('emlb:member-ids');
    const memberIds: string[] = memberIdsJson ? JSON.parse(memberIdsJson) : [];
    for (const mid of memberIds) {
      if (mid === auth.userId) continue; // don't notify the ticket author if they are admin
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
