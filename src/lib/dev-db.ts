/**
 * Dev-mode "database" — localStorage-based mock for library & book API endpoints.
 *
 * Data is stored **per-user** so switching accounts shows different books.
 *
 * Keys used:
 *   emlb-dev:u:{userId}:library          → BookMeta[]
 *   emlb-dev:u:{userId}:book:{bookId}    → BookProject JSON
 *   emlb-dev:tickets                      → Ticket[]
 *   emlb-dev:ticket:{id}:comments         → TicketComment[]
 *   emlb-dev:ticket:{id}:statusChanges    → TicketStatusChange[]
 *   emlb-dev:releases                     → Release[]
 */

import type { Ticket, TicketComment, TicketStatusChange, Release } from '@/types';
import { devAuth } from '@/lib/dev-auth';

// ─── Token decode (mirrors dev-auth.ts) ──────────────────────────────────────

function getCurrentUserId(): string | null {
  const token = localStorage.getItem('emlb-token');
  if (!token?.startsWith('dev-')) return null;
  try {
    const payload = JSON.parse(atob(token.slice(4))) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

function requireUserId(): string {
  const id = getCurrentUserId();
  if (!id) throw new Error('Non authentifié');
  return id;
}

function getCurrentUser() {
  const uid = requireUserId();
  const users = devAuth.listUsers();
  return users.find((u) => u.id === uid) ?? { id: uid, email: '', name: 'Inconnu', isAdmin: false, createdAt: '' };
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

const libraryKey = (uid: string) => `emlb-dev:u:${uid}:library`;
const bookKey = (uid: string, bookId: string) => `emlb-dev:u:${uid}:book:${bookId}`;

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

// ─── JSON helpers ────────────────────────────────────────────────────────────

function getJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Public API (same shape as the real serverless functions) ─────────────────

export const devDb = {
  library: {
    async get(): Promise<unknown[]> {
      const uid = requireUserId();
      const raw = localStorage.getItem(libraryKey(uid));
      return raw ? JSON.parse(raw) : [];
    },

    async save(books: unknown[]): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      localStorage.setItem(libraryKey(uid), JSON.stringify(books));
      return { ok: true };
    },
  },

  books: {
    async get(bookId: string): Promise<unknown> {
      const uid = requireUserId();
      const raw = localStorage.getItem(bookKey(uid, bookId));
      if (!raw) throw new Error('Livre introuvable');
      return JSON.parse(raw);
    },

    async save(bookId: string, data: unknown): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      localStorage.setItem(bookKey(uid, bookId), JSON.stringify(data));
      return { ok: true };
    },

    async delete(bookId: string): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      localStorage.removeItem(bookKey(uid, bookId));
      return { ok: true };
    },

    async migrate(data: {
      library: unknown[];
      books: { id: string; data: unknown }[];
    }): Promise<{ ok: boolean; migrated: number }> {
      const uid = requireUserId();
      localStorage.setItem(libraryKey(uid), JSON.stringify(data.library));
      for (const book of data.books) {
        localStorage.setItem(bookKey(uid, book.id), JSON.stringify(book.data));
      }
      return { ok: true, migrated: data.books.length };
    },
  },

  // ─── Tickets ─────────────────────────────────────────────────────────────

  tickets: {
    async list(): Promise<{ tickets: Ticket[]; statusChanges: TicketStatusChange[] }> {
      const uid = requireUserId();
      const user = getCurrentUser();
      const allTickets = getJson<Ticket[]>('emlb-dev:tickets', []);
      // User can see public tickets + their own private tickets
      const visible = allTickets.filter(
        (t) => t.visibility === 'public' || t.userId === uid || user.isAdmin
      );
      // Gather all status changes for visible tickets
      const allChanges: TicketStatusChange[] = [];
      for (const t of visible) {
        const changes = getJson<TicketStatusChange[]>(`emlb-dev:ticket:${t.id}:statusChanges`, []);
        allChanges.push(...changes);
      }
      return { tickets: visible, statusChanges: allChanges };
    },

    async create(data: {
      type: Ticket['type'];
      title: string;
      description: string;
      visibility: Ticket['visibility'];
    }): Promise<{ ticket: Ticket }> {
      const user = getCurrentUser();
      const ticket: Ticket = {
        id: generateId(),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        type: data.type,
        title: data.title,
        description: data.description,
        visibility: data.visibility,
        status: 'open',
        reactions: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const tickets = getJson<Ticket[]>('emlb-dev:tickets', []);
      tickets.push(ticket);
      setJson('emlb-dev:tickets', tickets);
      return { ticket };
    },

    async get(id: string): Promise<{ ticket: Ticket; comments: TicketComment[]; statusChanges: TicketStatusChange[] }> {
      const tickets = getJson<Ticket[]>('emlb-dev:tickets', []);
      const ticket = tickets.find((t) => t.id === id);
      if (!ticket) throw new Error('Ticket introuvable');
      const comments = getJson<TicketComment[]>(`emlb-dev:ticket:${id}:comments`, []);
      const statusChanges = getJson<TicketStatusChange[]>(`emlb-dev:ticket:${id}:statusChanges`, []);
      return { ticket, comments, statusChanges };
    },

    async update(id: string, data: Partial<Pick<Ticket, 'status' | 'releaseId'>>): Promise<{ ticket: Ticket }> {
      const tickets = getJson<Ticket[]>('emlb-dev:tickets', []);
      const idx = tickets.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error('Ticket introuvable');
      const oldTicket = tickets[idx];
      const updated = { ...oldTicket, ...data, updatedAt: new Date().toISOString() };
      tickets[idx] = updated;
      setJson('emlb-dev:tickets', tickets);

      // If status changed, add a status change entry
      if (data.status && data.status !== oldTicket.status) {
        const user = getCurrentUser();
        const changes = getJson<TicketStatusChange[]>(`emlb-dev:ticket:${id}:statusChanges`, []);
        changes.push({
          id: generateId(),
          ticketId: id,
          userId: user.id,
          userName: user.name,
          type: 'status_change',
          fromStatus: oldTicket.status,
          toStatus: data.status,
          createdAt: new Date().toISOString(),
        });
        setJson(`emlb-dev:ticket:${id}:statusChanges`, changes);
      }

      // If release changed, add a release assignment entry
      if (data.releaseId !== undefined && data.releaseId !== oldTicket.releaseId) {
        const user = getCurrentUser();
        const changes = getJson<TicketStatusChange[]>(`emlb-dev:ticket:${id}:statusChanges`, []);
        const releases = getJson<Release[]>('emlb-dev:releases', []);
        const release = releases.find((r) => r.id === data.releaseId);
        changes.push({
          id: generateId(),
          ticketId: id,
          userId: user.id,
          userName: user.name,
          type: 'release_assign',
          releaseId: data.releaseId || undefined,
          releaseName: release ? `v${release.version}${release.title ? ' — ' + release.title : ''}` : undefined,
          createdAt: new Date().toISOString(),
        });
        setJson(`emlb-dev:ticket:${id}:statusChanges`, changes);
      }

      return { ticket: updated };
    },

    async delete(id: string): Promise<{ ok: boolean }> {
      const tickets = getJson<Ticket[]>('emlb-dev:tickets', []);
      setJson('emlb-dev:tickets', tickets.filter((t) => t.id !== id));
      localStorage.removeItem(`emlb-dev:ticket:${id}:comments`);
      localStorage.removeItem(`emlb-dev:ticket:${id}:statusChanges`);
      return { ok: true };
    },

    async addComment(ticketId: string, content: string): Promise<{ comment: TicketComment }> {
      const user = getCurrentUser();
      const comment: TicketComment = {
        id: generateId(),
        ticketId,
        userId: user.id,
        userName: user.name,
        isAdmin: user.isAdmin,
        content,
        reactions: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const comments = getJson<TicketComment[]>(`emlb-dev:ticket:${ticketId}:comments`, []);
      comments.push(comment);
      setJson(`emlb-dev:ticket:${ticketId}:comments`, comments);
      return { comment };
    },

    async deleteComment(ticketId: string, commentId: string): Promise<{ ok: boolean }> {
      const comments = getJson<TicketComment[]>(`emlb-dev:ticket:${ticketId}:comments`, []);
      setJson(`emlb-dev:ticket:${ticketId}:comments`, comments.filter((c) => c.id !== commentId));
      return { ok: true };
    },

    async addReaction(ticketId: string, commentId: string, emoji: string): Promise<{ comment: TicketComment }> {
      const uid = requireUserId();
      // Reaction on ticket description
      if (commentId === '__desc__') {
        const tickets = getJson<Ticket[]>('emlb-dev:tickets', []);
        const idx = tickets.findIndex((t) => t.id === ticketId);
        if (idx === -1) throw new Error('Ticket introuvable');
        const ticket = { ...tickets[idx] };
        const reactions = { ...(ticket.reactions ?? {}) };
        const users = reactions[emoji] ?? [];
        if (users.includes(uid)) {
          reactions[emoji] = users.filter((u) => u !== uid);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...users, uid];
        }
        ticket.reactions = reactions;
        tickets[idx] = ticket;
        setJson('emlb-dev:tickets', tickets);
        // Return a dummy comment (the UI uses the ticket store to reload)
        return { comment: {} as TicketComment };
      }
      const comments = getJson<TicketComment[]>(`emlb-dev:ticket:${ticketId}:comments`, []);
      const idx = comments.findIndex((c) => c.id === commentId);
      if (idx === -1) throw new Error('Commentaire introuvable');
      const comment = { ...comments[idx] };
      const reactions = { ...comment.reactions };
      const users = reactions[emoji] ?? [];
      if (users.includes(uid)) {
        reactions[emoji] = users.filter((u) => u !== uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, uid];
      }
      comment.reactions = reactions;
      comments[idx] = comment;
      setJson(`emlb-dev:ticket:${ticketId}:comments`, comments);
      return { comment };
    },
  },

  // ─── Releases ────────────────────────────────────────────────────────────

  releases: {
    async list(): Promise<Release[]> {
      const user = getCurrentUser();
      const all = getJson<Release[]>('emlb-dev:releases', []);
      // Non-admin users don't see drafts
      return user.isAdmin ? all : all.filter((r) => r.status !== 'draft');
    },

    async get(id: string): Promise<Release> {
      const releases = getJson<Release[]>('emlb-dev:releases', []);
      const release = releases.find((r) => r.id === id);
      if (!release) throw new Error('Release introuvable');
      return release;
    },

    async create(data: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ release: Release }> {
      const release: Release = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      let releases = getJson<Release[]>('emlb-dev:releases', []);
      // Auto-demote: if setting this release to 'current', previous 'current' becomes 'released'
      if (data.status === 'current') {
        releases = releases.map((r) =>
          r.status === 'current' ? { ...r, status: 'released' as const, updatedAt: new Date().toISOString() } : r
        );
      }
      releases.push(release);
      setJson('emlb-dev:releases', releases);
      return { release };
    },

    async update(id: string, data: Partial<Release>): Promise<{ release: Release }> {
      let releases = getJson<Release[]>('emlb-dev:releases', []);
      const idx = releases.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error('Release introuvable');
      // Auto-demote: if setting this release to 'current', previous 'current' becomes 'released'
      if (data.status === 'current' && releases[idx].status !== 'current') {
        releases = releases.map((r, i) =>
          i !== idx && r.status === 'current'
            ? { ...r, status: 'released' as const, updatedAt: new Date().toISOString() }
            : r
        );
      }
      const updated = { ...releases[idx], ...data, updatedAt: new Date().toISOString() };
      releases[idx] = updated;
      setJson('emlb-dev:releases', releases);
      return { release: updated };
    },

    async delete(id: string): Promise<{ ok: boolean }> {
      const releases = getJson<Release[]>('emlb-dev:releases', []);
      setJson('emlb-dev:releases', releases.filter((r) => r.id !== id));
      return { ok: true };
    },
  },

  // ─── Admin ───────────────────────────────────────────────────────────────

  admin: {
    async members(): Promise<{ members: Array<{ id: string; email: string; name: string; isAdmin: boolean; createdAt: string; booksCount: number }> }> {
      const users = devAuth.listUsers();
      const members = users.map((u) => {
        const libKey = `emlb-dev:u:${u.id}:library`;
        const books = getJson<unknown[]>(libKey, []);
        return {
          ...u,
          booksCount: books.length,
        };
      });
      return { members };
    },
  },
};
