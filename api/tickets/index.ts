import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth, getAuthUser } from '../_lib/auth';
import { cors } from '../_lib/cors';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

interface Ticket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'bug' | 'question' | 'improvement';
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
    const { type, title, description, visibility } = req.body;
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

    // Send email notification (optional - if RESEND_API_KEY is set)
    const resendKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'jonathancambot+eml-tickets@hotmail.com';
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'Ecrire Mon Livre <tickets@ecrire-mon-livre.fr>',
            to: supportEmail,
            subject: `[Ticket ${type}] ${title}`,
            html: `<h2>${title}</h2><p><strong>Type :</strong> ${type}</p><p><strong>Par :</strong> ${user.name} (${user.email})</p><hr/>${description}`,
          }),
        });
      } catch (e) {
        console.error('Email send failed:', e);
      }
    }

    return res.json({ ticket });
  }

  return res.status(405).end();
}
