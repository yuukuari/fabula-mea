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

import type { Ticket, TicketComment, TicketStatusChange, Release, ReviewSession, ReviewComment } from '@/types';
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

// ─── Dev email logging ───────────────────────────────────────────────────────

function devEmailLog(opts: { to: string; subject: string; description: string; details?: Record<string, string> }): void {
  console.group(`📧 [DEV] Email — ${opts.description}`);
  console.log(`   To:      ${opts.to}`);
  console.log(`   Subject: ${opts.subject}`);
  if (opts.details) {
    for (const [key, value] of Object.entries(opts.details)) {
      console.log(`   ${key}: ${value}`);
    }
  }
  console.log('   (email non envoyé en mode développement)');
  console.groupEnd();
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
      module?: Ticket['module'];
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
        module: data.module,
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

      // Log email that would be sent to admins in production
      const allUsers = devAuth.listUsers();
      const admins = allUsers.filter((u) => u.isAdmin);
      for (const admin of admins) {
        devEmailLog({
          to: admin.email,
          subject: `[Ticket ${data.type}] ${data.title}`,
          description: 'Notification nouveau ticket → admin',
          details: {
            'Type': data.type,
            ...(data.module ? { 'Section': data.module } : {}),
            'Par': `${user.name} (${user.email})`,
            'Visibilité': data.visibility,
          },
        });
      }
      if (admins.length === 0) {
        devEmailLog({
          to: '(aucun admin trouvé — en prod: support email)',
          subject: `[Ticket ${data.type}] ${data.title}`,
          description: 'Notification nouveau ticket → admin',
          details: {
            'Type': data.type,
            'Par': `${user.name} (${user.email})`,
          },
        });
      }

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

  // ─── Reviews (relecture) ────────────────────────────────────────────────

  reviews: {
    /** List all review sessions for the current (author) user */
    async list(): Promise<ReviewSession[]> {
      const uid = requireUserId();
      const sessionIds = getJson<string[]>(`emlb-dev:u:${uid}:reviews`, []);
      const sessions: ReviewSession[] = [];
      for (const sid of sessionIds) {
        const s = getJson<ReviewSession | null>(`emlb-dev:review:${sid}`, null);
        if (s) {
          // Compute pendingCommentsCount from actual comments
          const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sid}:comments`, []);
          s.pendingCommentsCount = comments.filter(c => !c.parentId && c.status === 'sent' && !c.isAuthor).length;
          sessions.push(s);
        }
      }
      return sessions;
    },

    /** Create a new review session (author side) */
    async create(data: {
      bookId: string;
      bookTitle: string;
      authorName: string;
      authorEmail: string;
      readerEmail?: string;
      snapshot: ReviewSession['snapshot'];
    }): Promise<{ session: ReviewSession }> {
      const uid = requireUserId();
      const token = generateId() + generateId(); // longer token for security
      const session: ReviewSession = {
        id: generateId(),
        bookId: data.bookId,
        bookTitle: data.bookTitle,
        authorName: data.authorName,
        authorEmail: data.authorEmail,
        userId: uid,
        token,
        readerEmail: data.readerEmail,
        status: 'pending',
        snapshot: data.snapshot,
        commentsCount: 0,
        pendingCommentsCount: 0,
        createdAt: new Date().toISOString(),
      };
      // Store session by token (for public access)
      setJson(`emlb-dev:review:token:${token}`, session);
      // Store session by id (for author access)
      setJson(`emlb-dev:review:${session.id}`, session);
      // Add to the author's session list
      const sessionIds = getJson<string[]>(`emlb-dev:u:${uid}:reviews`, []);
      sessionIds.push(session.id);
      setJson(`emlb-dev:u:${uid}:reviews`, sessionIds);

      // Log email that would be sent in production
      if (data.readerEmail) {
        devEmailLog({
          to: data.readerEmail,
          subject: `${data.authorName} vous invite à relire « ${data.bookTitle} »`,
          description: 'Invitation à la relecture',
          details: {
            'Auteur': data.authorName,
            'Livre': data.bookTitle,
            'Lien': `${window.location.origin}/review/${token}`,
          },
        });
      }

      return { session };
    },

    /** Get a specific session (author side, by id) */
    async get(id: string): Promise<{ session: ReviewSession; comments: ReviewComment[] }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:${id}`, null);
      if (!session) throw new Error('Session introuvable');
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${id}:comments`, []);
      // Compute pendingCommentsCount from actual comments
      session.pendingCommentsCount = comments.filter(c => !c.parentId && c.status === 'sent' && !c.isAuthor).length;
      return { session, comments };
    },

    /** Delete a review session */
    async delete(id: string): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      const session = getJson<ReviewSession | null>(`emlb-dev:review:${id}`, null);
      if (!session) throw new Error('Session introuvable');
      // Remove session data
      localStorage.removeItem(`emlb-dev:review:${id}`);
      localStorage.removeItem(`emlb-dev:review:token:${session.token}`);
      localStorage.removeItem(`emlb-dev:review:${id}:comments`);
      // Remove from author's list
      const sessionIds = getJson<string[]>(`emlb-dev:u:${uid}:reviews`, []);
      setJson(`emlb-dev:u:${uid}:reviews`, sessionIds.filter((s) => s !== id));
      return { ok: true };
    },

    /** Close a review session (author => marks as 'closed', hides content from reader) */
    async closeSession(id: string): Promise<{ session: ReviewSession }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:${id}`, null);
      if (!session) throw new Error('Session introuvable');
      session.status = 'closed';
      session.closedAt = new Date().toISOString();
      setJson(`emlb-dev:review:${id}`, session);
      setJson(`emlb-dev:review:token:${session.token}`, session);
      return { session };
    },

    /** Author replies to a comment or closes it */
    async addComment(sessionId: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ comment: ReviewComment }> {
      const newComment: ReviewComment = {
        ...comment,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
      comments.push(newComment);
      setJson(`emlb-dev:review:${sessionId}:comments`, comments);
      // Update comments count on session
      const session = getJson<ReviewSession | null>(`emlb-dev:review:${sessionId}`, null);
      if (session) {
        session.commentsCount = comments.filter((c) => !c.parentId).length;
        setJson(`emlb-dev:review:${sessionId}`, session);
        setJson(`emlb-dev:review:token:${session.token}`, session);
      }
      return { comment: newComment };
    },

    /** Update a comment (content or status) */
    async updateComment(sessionId: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>): Promise<{ comment: ReviewComment }> {
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
      const idx = comments.findIndex((c) => c.id === commentId);
      if (idx === -1) throw new Error('Commentaire introuvable');
      comments[idx] = { ...comments[idx], ...data, updatedAt: new Date().toISOString() };
      setJson(`emlb-dev:review:${sessionId}:comments`, comments);
      return { comment: comments[idx] };
    },

    /** Delete a comment */
    async deleteComment(sessionId: string, commentId: string): Promise<{ ok: boolean }> {
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
      const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
      setJson(`emlb-dev:review:${sessionId}:comments`, filtered);
      // Update count
      const session = getJson<ReviewSession | null>(`emlb-dev:review:${sessionId}`, null);
      if (session) {
        session.commentsCount = filtered.filter((c) => !c.parentId).length;
        setJson(`emlb-dev:review:${sessionId}`, session);
        setJson(`emlb-dev:review:token:${session.token}`, session);
      }
      return { ok: true };
    },

    /** Batch-send author draft comments — marks as sent and notifies reader */
    async sendAuthorComments(sessionId: string): Promise<{ sent: number }> {
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
      let sent = 0;
      for (let i = 0; i < comments.length; i++) {
        if (comments[i].status === 'draft' && comments[i].isAuthor) {
          comments[i] = { ...comments[i], status: 'sent', updatedAt: new Date().toISOString() };
          sent++;
        }
      }
      setJson(`emlb-dev:review:${sessionId}:comments`, comments);

      // Log email that would be sent to reader in production
      if (sent > 0) {
        const session = getJson<ReviewSession | null>(`emlb-dev:review:${sessionId}`, null);
        if (session?.readerEmail) {
          devEmailLog({
            to: session.readerEmail,
            subject: `${session.authorName} a répondu à vos commentaires sur « ${session.bookTitle} »`,
            description: 'Notification réponses auteur → relecteur',
            details: {
              'Auteur': session.authorName,
              'Livre': session.bookTitle,
              'Réponses': `${sent}`,
            },
          });
        }
      }

      return { sent };
    },

    /** Batch-send draft comments (reader side — mark as sent) */
    async sendComments(sessionId: string): Promise<{ sent: number }> {
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
      let sent = 0;
      for (let i = 0; i < comments.length; i++) {
        if (comments[i].status === 'draft') {
          comments[i] = { ...comments[i], status: 'sent', updatedAt: new Date().toISOString() };
          sent++;
        }
      }
      setJson(`emlb-dev:review:${sessionId}:comments`, comments);

      // Log email that would be sent to author in production
      if (sent > 0) {
        const session = getJson<ReviewSession | null>(`emlb-dev:review:${sessionId}`, null);
        if (session?.authorEmail) {
          devEmailLog({
            to: session.authorEmail,
            subject: `${session.readerName || 'Un relecteur'} a envoyé ${sent} commentaire${sent > 1 ? 's' : ''} sur « ${session.bookTitle} »`,
            description: 'Notification commentaires relecture',
            details: {
              'Relecteur': session.readerName || 'Un relecteur',
              'Livre': session.bookTitle,
              'Commentaires': `${sent}`,
            },
          });
        }
      }

      return { sent };
    },
  },

  // ─── Review public (reader side, by token) ─────────────────────────────

  reviewPublic: {
    /** Get session by public token */
    async getByToken(token: string): Promise<{ session: ReviewSession }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      return { session };
    },

    /** Start the review (reader chooses their name) */
    async start(token: string, data: { readerName: string }): Promise<{ session: ReviewSession }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      session.readerName = data.readerName;
      session.status = 'in_progress';
      session.startedAt = new Date().toISOString();
      setJson(`emlb-dev:review:token:${token}`, session);
      setJson(`emlb-dev:review:${session.id}`, session);
      return { session };
    },

    /** Get comments for a session (by token) */
    async getComments(token: string): Promise<ReviewComment[]> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      return getJson<ReviewComment[]>(`emlb-dev:review:${session.id}:comments`, []);
    },

    /** Add a comment (reader side) */
    async addComment(token: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ comment: ReviewComment }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      const newComment: ReviewComment = {
        ...comment,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${session.id}:comments`, []);
      comments.push(newComment);
      setJson(`emlb-dev:review:${session.id}:comments`, comments);
      // Update comments count
      session.commentsCount = comments.filter((c) => !c.parentId).length;
      setJson(`emlb-dev:review:token:${token}`, session);
      setJson(`emlb-dev:review:${session.id}`, session);
      return { comment: newComment };
    },

    /** Update a comment (reader side) */
    async updateComment(token: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>): Promise<{ comment: ReviewComment }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${session.id}:comments`, []);
      const idx = comments.findIndex((c) => c.id === commentId);
      if (idx === -1) throw new Error('Commentaire introuvable');
      comments[idx] = { ...comments[idx], ...data, updatedAt: new Date().toISOString() };
      setJson(`emlb-dev:review:${session.id}:comments`, comments);
      return { comment: comments[idx] };
    },

    /** Delete a comment (reader side) */
    async deleteComment(token: string, commentId: string): Promise<{ ok: boolean }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${session.id}:comments`, []);
      const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
      setJson(`emlb-dev:review:${session.id}:comments`, filtered);
      session.commentsCount = filtered.filter((c) => !c.parentId).length;
      setJson(`emlb-dev:review:token:${token}`, session);
      setJson(`emlb-dev:review:${session.id}`, session);
      return { ok: true };
    },

    /** Send all draft comments (marks as sent) */
    async sendComments(token: string): Promise<{ sent: number }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      const comments = getJson<ReviewComment[]>(`emlb-dev:review:${session.id}:comments`, []);
      let sent = 0;
      for (let i = 0; i < comments.length; i++) {
        if (comments[i].status === 'draft') {
          comments[i] = { ...comments[i], status: 'sent', updatedAt: new Date().toISOString() };
          sent++;
        }
      }
      setJson(`emlb-dev:review:${session.id}:comments`, comments);

      // Log email that would be sent to author in production
      if (sent > 0 && session.authorEmail) {
        devEmailLog({
          to: session.authorEmail,
          subject: `${session.readerName || 'Un relecteur'} a envoyé ${sent} commentaire${sent > 1 ? 's' : ''} sur « ${session.bookTitle} »`,
          description: 'Notification commentaires relecture',
          details: {
            'Relecteur': session.readerName || 'Un relecteur',
            'Livre': session.bookTitle,
            'Commentaires': `${sent}`,
          },
        });
      }

      return { sent };
    },

    /** Mark the review as completed */
    async complete(token: string): Promise<{ session: ReviewSession }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
      if (!session) throw new Error('Session introuvable');
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      setJson(`emlb-dev:review:token:${token}`, session);
      setJson(`emlb-dev:review:${session.id}`, session);

      // Log email that would be sent to author in production
      if (session.authorEmail) {
        devEmailLog({
          to: session.authorEmail,
          subject: `${session.readerName || 'Un relecteur'} a terminé la relecture de « ${session.bookTitle} »`,
          description: 'Notification relecture terminée',
          details: {
            'Relecteur': session.readerName || 'Un relecteur',
            'Livre': session.bookTitle,
          },
        });
      }

      return { session };
    },
  },
};
