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

import type { Ticket, TicketComment, TicketStatusChange, Release, ReviewSession, ReviewComment, VersionMeta, VersionStats, AppNotification } from '@/types';
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
const sagasListKey = (uid: string) => `emlb-dev:u:${uid}:sagas`;
const sagaKey = (uid: string, sagaId: string) => `emlb-dev:u:${uid}:saga:${sagaId}`;
const bookHistoryKey = (uid: string, bookId: string) => `emlb-dev:u:${uid}:book:${bookId}:history`;

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

// ─── Review session helpers ──────────────────────────────────────────────────

function getSessionByToken(token: string): ReviewSession {
  const session = getJson<ReviewSession | null>(`emlb-dev:review:token:${token}`, null);
  if (!session) throw new Error('Session introuvable');
  return session;
}

function saveSession(session: ReviewSession): void {
  setJson(`emlb-dev:review:${session.id}`, session);
  setJson(`emlb-dev:review:token:${session.token}`, session);
}

function addReviewCommentShared(sessionId: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>): { comment: ReviewComment; session: ReviewSession | null } {
  const newComment: ReviewComment = {
    ...comment,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
  comments.push(newComment);
  setJson(`emlb-dev:review:${sessionId}:comments`, comments);
  const session = getJson<ReviewSession | null>(`emlb-dev:review:${sessionId}`, null);
  if (session) {
    session.commentsCount = comments.filter((c) => !c.parentId).length;
    saveSession(session);
  }
  return { comment: newComment, session };
}

function updateReviewCommentShared(sessionId: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>): { comment: ReviewComment } {
  const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
  const idx = comments.findIndex((c) => c.id === commentId);
  if (idx === -1) throw new Error('Commentaire introuvable');
  comments[idx] = { ...comments[idx], ...data, updatedAt: new Date().toISOString() };
  setJson(`emlb-dev:review:${sessionId}:comments`, comments);
  return { comment: comments[idx] };
}

function deleteReviewCommentShared(sessionId: string, commentId: string): void {
  const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
  const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
  setJson(`emlb-dev:review:${sessionId}:comments`, filtered);
  const session = getJson<ReviewSession | null>(`emlb-dev:review:${sessionId}`, null);
  if (session) {
    session.commentsCount = filtered.filter((c) => !c.parentId).length;
    saveSession(session);
  }
}

function batchSendDrafts(sessionId: string, filterAuthorOnly: boolean): { sent: number; session: ReviewSession | null } {
  const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sessionId}:comments`, []);
  let sent = 0;
  for (let i = 0; i < comments.length; i++) {
    if (comments[i].status === 'draft' && (!filterAuthorOnly || comments[i].isAuthor)) {
      comments[i] = { ...comments[i], status: 'sent', updatedAt: new Date().toISOString() };
      sent++;
    }
  }
  setJson(`emlb-dev:review:${sessionId}:comments`, comments);
  const session = getJson<ReviewSession | null>(`emlb-dev:review:${sessionId}`, null);
  return { sent, session };
}

// ─── Ticket change helper ───────────────────────────────────────────────────

function recordTicketChange(ticketId: string, change: Record<string, unknown>): void {
  const user = getCurrentUser();
  const changes = getJson<TicketStatusChange[]>(`emlb-dev:ticket:${ticketId}:statusChanges`, []);
  changes.push({
    id: generateId(),
    ticketId,
    userId: user.id,
    userName: user.name,
    ...change,
    createdAt: new Date().toISOString(),
  } as TicketStatusChange);
  setJson(`emlb-dev:ticket:${ticketId}:statusChanges`, changes);
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

// ─── Notification helpers ────────────────────────────────────────────────────

const NOTIFICATIONS_KEY = 'emlb-dev:notifications';
const MAX_NOTIFICATIONS = 200;

function notificationReadsKey(uid: string) {
  return `emlb-dev:u:${uid}:notification-reads`;
}

function createNotification(opts: {
  type: AppNotification['type'];
  actorId: string;
  actorName: string;
  message: string;
  link: string;
  payload: Record<string, string>;
  recipientIds: string[];
}): AppNotification | null {
  // No recipients → no notification
  if (opts.recipientIds.length === 0) return null;

  const notification: AppNotification = {
    id: generateId(),
    type: opts.type,
    actorId: opts.actorId,
    actorName: opts.actorName,
    message: opts.message,
    link: opts.link,
    payload: opts.payload,
    recipientIds: opts.recipientIds,
    createdAt: new Date().toISOString(),
  };

  const notifications = getJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
  notifications.unshift(notification);
  if (notifications.length > MAX_NOTIFICATIONS) notifications.length = MAX_NOTIFICATIONS;
  setJson(NOTIFICATIONS_KEY, notifications);

  return notification;
}

function createTicketCommentNotification(ticketId: string, commenterId: string, commenterName: string): void {
  const tickets = getJson<Ticket[]>('emlb-dev:tickets', []);
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) return;

  const comments = getJson<TicketComment[]>(`emlb-dev:ticket:${ticketId}:comments`, []);
  const commenterIds = new Set(comments.map((c) => c.userId));
  commenterIds.add(ticket.userId); // ticket creator always notified
  commenterIds.delete(commenterId); // exclude the commenter

  const recipientIds = Array.from(commenterIds);

  createNotification({
    type: 'ticket_comment',
    actorId: commenterId,
    actorName: commenterName,
    message: '{{actorName}} a commenté le ticket « {{ticketTitle}} »',
    link: `/tickets?id=${ticketId}`,
    payload: { ticketId, ticketTitle: ticket.title },
    recipientIds,
  });
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
      // Record version history before overwriting (never fail the save)
      try { devDb.versionHistory._recordIfNeeded(uid, bookId); } catch { /* ignore */ }
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

  // ─── Version History ───────────────────────────────────────────────────

  versionHistory: {
    _extractStats(bookData: Record<string, unknown>, sagaData?: Record<string, unknown>): VersionStats {
      const chapters = Array.isArray(bookData.chapters)
        ? (bookData.chapters as Array<{ type?: string }>).filter((c) => c.type === 'chapter').length
        : 0;
      const scenes = Array.isArray(bookData.scenes) ? bookData.scenes.length : 0;
      const events = Array.isArray(bookData.timelineEvents) ? bookData.timelineEvents.length : 0;
      const words = Array.isArray(bookData.scenes)
        ? (bookData.scenes as Array<{ currentWordCount?: number }>).reduce((sum, s) => sum + (s.currentWordCount ?? 0), 0)
        : 0;
      // Characters/places/worldNotes/maps: use saga data if available, otherwise book data
      const encSource = sagaData ?? bookData;
      const characters = Array.isArray(encSource.characters) ? encSource.characters.length : 0;
      const places = Array.isArray(encSource.places) ? encSource.places.length : 0;
      const worldNotes = Array.isArray(encSource.worldNotes) ? encSource.worldNotes.length : 0;
      const maps = Array.isArray(encSource.maps) ? encSource.maps.length : 0;
      const notes = Array.isArray(bookData.noteIdeas) ? bookData.noteIdeas.length : 0;
      return { chapters, scenes, events, words, characters, places, worldNotes, maps, notes };
    },

    /** Get saga data for a book if it belongs to a saga */
    _getSagaData(uid: string, bookData: Record<string, unknown>): Record<string, unknown> | undefined {
      const sagaId = bookData.sagaId as string | undefined;
      if (!sagaId) return undefined;
      const raw = localStorage.getItem(sagaKey(uid, sagaId));
      return raw ? JSON.parse(raw) as Record<string, unknown> : undefined;
    },

    async list(bookId: string): Promise<{ versions: VersionMeta[] }> {
      const uid = requireUserId();
      const history = getJson<Array<{ meta: VersionMeta; data: unknown }>>(bookHistoryKey(uid, bookId), []);
      return { versions: history.map((entry, i) => ({ ...entry.meta, index: i })) };
    },

    async getVersion(bookId: string, index: number): Promise<{ meta: VersionMeta; data: unknown }> {
      const uid = requireUserId();
      const history = getJson<Array<{ meta: VersionMeta; data: unknown; sagaData?: unknown }>>(bookHistoryKey(uid, bookId), []);
      if (index < 0 || index >= history.length) throw new Error('Version introuvable');
      return { meta: { ...history[index].meta, index }, data: history[index].data, ...(history[index].sagaData ? { sagaData: history[index].sagaData } : {}) } as { meta: VersionMeta; data: unknown };
    },

    async restore(bookId: string, index: number): Promise<{ ok: boolean; data: unknown }> {
      const uid = requireUserId();
      const hKey = bookHistoryKey(uid, bookId);
      const history = getJson<Array<{ meta: { savedAt: string; title: string; stats: VersionStats; isRestore?: boolean }; data: Record<string, unknown>; sagaData?: Record<string, unknown> }>>(hKey, []);
      if (index < 0 || index >= history.length) throw new Error('Version introuvable');

      // Grab the entry to restore BEFORE modifying the array
      const entryToRestore = history[index];

      // Save current as a new history entry before restoring
      const currentRaw = localStorage.getItem(bookKey(uid, bookId));
      if (currentRaw) {
        const currentData = JSON.parse(currentRaw) as Record<string, unknown>;
        const currentSagaData = this._getSagaData(uid, currentData);
        history.unshift({
          meta: {
            savedAt: new Date().toISOString(),
            title: (currentData.title as string) ?? '',
            stats: this._extractStats(currentData, currentSagaData),
            isRestore: true,
          },
          data: currentData,
          ...(currentSagaData ? { sagaData: currentSagaData } : {}),
        });
        // Keep max 20
        if (history.length > 20) history.length = 20;
      }

      // Restore book using the pre-saved reference
      const restoredData: Record<string, unknown> = { ...entryToRestore.data, updatedAt: new Date().toISOString() };
      localStorage.setItem(bookKey(uid, bookId), JSON.stringify(restoredData));

      // Restore saga if snapshot included saga data
      if (entryToRestore.sagaData && restoredData.sagaId) {
        const restoredSaga = { ...entryToRestore.sagaData, updatedAt: new Date().toISOString() };
        localStorage.setItem(sagaKey(uid, restoredData.sagaId as string), JSON.stringify(restoredSaga));
      }

      setJson(hKey, history);
      return { ok: true, data: restoredData };
    },

    /** Called by books.save to record a version snapshot (with dedup) */
    _recordIfNeeded(uid: string, bookId: string): void {
      const hKey = bookHistoryKey(uid, bookId);
      const currentRaw = localStorage.getItem(bookKey(uid, bookId));
      if (!currentRaw) return;

      const history = getJson<Array<{ meta: { savedAt: string; title: string; stats: VersionStats }; data: Record<string, unknown>; sagaData?: unknown }>>(hKey, []);

      // Dedup by time: skip if last snapshot is < 15 minutes old
      if (history.length > 0) {
        const lastSavedAt = new Date(history[0].meta.savedAt).getTime();
        if (Date.now() - lastSavedAt < 15 * 60 * 1000) return;
      }

      const currentData = JSON.parse(currentRaw) as Record<string, unknown>;

      // Dedup by content: skip if book updatedAt hasn't changed since last snapshot
      if (history.length > 0) {
        const lastData = history[0].data;
        if (lastData.updatedAt === currentData.updatedAt) {
          return;
        }
      }

      const currentSagaData = this._getSagaData(uid, currentData);
      history.unshift({
        meta: {
          savedAt: new Date().toISOString(),
          title: (currentData.title as string) ?? '',
          stats: this._extractStats(currentData, currentSagaData),
        },
        data: currentData,
        ...(currentSagaData ? { sagaData: currentSagaData } : {}),
      });
      if (history.length > 20) history.length = 20;
      setJson(hKey, history);
    },
  },

  // ─── Sagas ──────────────────────────────────────────────────────────────

  sagas: {
    async getMeta(): Promise<unknown[]> {
      const uid = requireUserId();
      return getJson(sagasListKey(uid), []);
    },

    async saveMeta(sagas: unknown[]): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      setJson(sagasListKey(uid), sagas);
      return { ok: true };
    },

    async get(sagaId: string): Promise<unknown> {
      const uid = requireUserId();
      const raw = localStorage.getItem(sagaKey(uid, sagaId));
      if (!raw) throw new Error('Saga introuvable');
      return JSON.parse(raw);
    },

    async save(sagaId: string, data: unknown): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      setJson(sagaKey(uid, sagaId), data);
      return { ok: true };
    },

    async delete(sagaId: string): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      localStorage.removeItem(sagaKey(uid, sagaId));
      return { ok: true };
    },
  },

  // ─── Tickets ─────────────────────────────────────────────────────────────

  tickets: {
    async list(): Promise<{ tickets: Ticket[]; statusChanges: TicketStatusChange[]; releaseContributors: Record<string, string[]> }> {
      const uid = requireUserId();
      const user = getCurrentUser();
      const allTickets = getJson<Ticket[]>('emlb-dev:tickets', []);

      // Build releaseContributors from ALL tickets (including private ones)
      const releaseContributors: Record<string, string[]> = {};
      for (const t of allTickets) {
        if (t.releaseId) {
          if (!releaseContributors[t.releaseId]) releaseContributors[t.releaseId] = [];
          if (!releaseContributors[t.releaseId].includes(t.userName)) {
            releaseContributors[t.releaseId].push(t.userName);
          }
        }
      }

      // User can see public tickets + their own private tickets
      const visible = allTickets.filter(
        (t) => t.visibility === 'public' || t.userId === uid || user.isAdmin
      );
      // Gather all status changes for visible tickets + comment counts
      const allChanges: TicketStatusChange[] = [];
      const ticketsWithCounts = visible.map((t) => {
        const changes = getJson<TicketStatusChange[]>(`emlb-dev:ticket:${t.id}:statusChanges`, []);
        allChanges.push(...changes);
        const comments = getJson<TicketComment[]>(`emlb-dev:ticket:${t.id}:comments`, []);
        return { ...t, commentCount: comments.length };
      });
      return { tickets: ticketsWithCounts, statusChanges: allChanges, releaseContributors };
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

    async update(id: string, data: Partial<Pick<Ticket, 'status' | 'releaseId' | 'type' | 'module'>>): Promise<{ ticket: Ticket }> {
      const tickets = getJson<Ticket[]>('emlb-dev:tickets', []);
      const idx = tickets.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error('Ticket introuvable');
      const oldTicket = tickets[idx];
      const updated = { ...oldTicket, ...data, updatedAt: new Date().toISOString() };
      tickets[idx] = updated;
      setJson('emlb-dev:tickets', tickets);

      if (data.status && data.status !== oldTicket.status) {
        recordTicketChange(id, { type: 'status_change', fromStatus: oldTicket.status, toStatus: data.status });
      }
      if (data.releaseId !== undefined && data.releaseId !== oldTicket.releaseId) {
        const releases = getJson<Release[]>('emlb-dev:releases', []);
        const release = releases.find((r) => r.id === data.releaseId);
        recordTicketChange(id, {
          type: 'release_assign',
          releaseId: data.releaseId || undefined,
          releaseName: release ? `v${release.version}${release.title ? ' — ' + release.title : ''}` : undefined,
        });
      }
      if (data.type && data.type !== oldTicket.type) {
        recordTicketChange(id, { type: 'type_change', fromType: oldTicket.type, toType: data.type });
      }
      if (data.module !== undefined && (data.module || null) !== (oldTicket.module || null)) {
        recordTicketChange(id, { type: 'module_change', fromModule: oldTicket.module || null, toModule: data.module || null });
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

      // Create notification for ticket participants
      createTicketCommentNotification(ticketId, user.id, user.name);

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
    async getUserDetail(userId: string) {
      const { aiDevMock } = await import('@/lib/ai/dev-mock');
      return aiDevMock.adminGetUserDetail(userId);
    },
    async setAiLimits(userId: string, limits: import('@/types').AiLimits | null): Promise<{ ok: boolean }> {
      const { aiDevMock } = await import('@/lib/ai/dev-mock');
      await aiDevMock.adminSetUserLimits(userId, limits);
      return { ok: true };
    },
  },

  // ─── Notifications ──────────────────────────────────────────────────────

  notifications: {
    async list(): Promise<{ notifications: AppNotification[]; readIds: string[] }> {
      const uid = requireUserId();
      const all = getJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
      // Only return notifications where the current user is a recipient
      const notifications = all.filter((n) => n.recipientIds.includes(uid));
      const readIds = getJson<string[]>(notificationReadsKey(uid), []);
      return { notifications, readIds };
    },

    async markRead(notificationId: string): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      const readIds = getJson<string[]>(notificationReadsKey(uid), []);
      if (!readIds.includes(notificationId)) {
        readIds.push(notificationId);
        setJson(notificationReadsKey(uid), readIds);
      }
      return { ok: true };
    },

    async markAllRead(): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      const all = getJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
      const myNotifIds = all.filter((n) => n.recipientIds.includes(uid)).map((n) => n.id);
      setJson(notificationReadsKey(uid), myNotifIds);
      return { ok: true };
    },

    async markReadByPayload(key: string, value: string): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      const all = getJson<AppNotification[]>(NOTIFICATIONS_KEY, []);
      const readIds = getJson<string[]>(notificationReadsKey(uid), []);
      const toMark = all
        .filter((n) => n.recipientIds.includes(uid) && n.payload[key] === value)
        .map((n) => n.id);
      const newReadIds = [...new Set([...readIds, ...toMark])];
      setJson(notificationReadsKey(uid), newReadIds);
      return { ok: true };
    },

    async registerPush(subscription: PushSubscriptionJSON): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      setJson(`emlb-dev:u:${uid}:push-subscription`, subscription);
      return { ok: true };
    },

    async unregisterPush(): Promise<{ ok: boolean }> {
      const uid = requireUserId();
      localStorage.removeItem(`emlb-dev:u:${uid}:push-subscription`);
      return { ok: true };
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
          // Compute pendingCommentsCount and authorDraftCount from actual comments
          const comments = getJson<ReviewComment[]>(`emlb-dev:review:${sid}:comments`, []);
          s.pendingCommentsCount = comments.filter(c => !c.parentId && c.status === 'sent' && !c.isAuthor).length;
          s.authorDraftCount = comments.filter(c => c.status === 'draft' && c.isAuthor).length;
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
      saveSession(session);
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

    async closeSession(id: string): Promise<{ session: ReviewSession }> {
      const session = getJson<ReviewSession | null>(`emlb-dev:review:${id}`, null);
      if (!session) throw new Error('Session introuvable');
      session.status = 'closed';
      session.closedAt = new Date().toISOString();
      saveSession(session);
      return { session };
    },

    async addComment(sessionId: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ comment: ReviewComment }> {
      return addReviewCommentShared(sessionId, comment);
    },

    async updateComment(sessionId: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>): Promise<{ comment: ReviewComment }> {
      return updateReviewCommentShared(sessionId, commentId, data);
    },

    async deleteComment(sessionId: string, commentId: string): Promise<{ ok: boolean }> {
      deleteReviewCommentShared(sessionId, commentId);
      return { ok: true };
    },

    async sendAuthorComments(sessionId: string): Promise<{ sent: number }> {
      const { sent, session } = batchSendDrafts(sessionId, true);
      if (sent > 0 && session?.readerEmail) {
        devEmailLog({
          to: session.readerEmail,
          subject: `${session.authorName} a répondu à vos commentaires sur « ${session.bookTitle} »`,
          description: 'Notification réponses auteur → relecteur',
          details: { 'Auteur': session.authorName, 'Livre': session.bookTitle, 'Réponses': `${sent}` },
        });
      }
      return { sent };
    },

    async sendComments(sessionId: string): Promise<{ sent: number }> {
      const { sent, session } = batchSendDrafts(sessionId, false);
      if (sent > 0 && session?.authorEmail) {
        devEmailLog({
          to: session.authorEmail,
          subject: `${session.readerName || 'Un relecteur'} a envoyé ${sent} commentaire${sent > 1 ? 's' : ''} sur « ${session.bookTitle} »`,
          description: 'Notification commentaires relecture',
          details: { 'Relecteur': session.readerName || 'Un relecteur', 'Livre': session.bookTitle, 'Commentaires': `${sent}` },
        });
        createNotification({
          type: 'review_comments_sent',
          actorId: 'reader',
          actorName: session.readerName || 'Un relecteur',
          message: '{{actorName}} a envoyé {{commentCount}} commentaire{{pluralS}} sur « {{bookTitle}} »',
          link: `/reviews/${session.id}`,
          payload: { reviewId: session.id, bookTitle: session.bookTitle, commentCount: `${sent}`, pluralS: sent > 1 ? 's' : '' },
          recipientIds: [session.userId],
        });
      }
      return { sent };
    },
  },

  // ─── Review public (reader side, by token) ─────────────────────────────

  reviewPublic: {
    async getByToken(token: string): Promise<{ session: ReviewSession }> {
      return { session: getSessionByToken(token) };
    },

    async start(token: string, data: { readerName: string }): Promise<{ session: ReviewSession }> {
      const session = getSessionByToken(token);
      session.readerName = data.readerName;
      session.status = 'in_progress';
      session.startedAt = new Date().toISOString();
      saveSession(session);
      return { session };
    },

    async getComments(token: string): Promise<ReviewComment[]> {
      const session = getSessionByToken(token);
      return getJson<ReviewComment[]>(`emlb-dev:review:${session.id}:comments`, []);
    },

    async addComment(token: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ comment: ReviewComment }> {
      const session = getSessionByToken(token);
      return addReviewCommentShared(session.id, comment);
    },

    async updateComment(token: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>): Promise<{ comment: ReviewComment }> {
      const session = getSessionByToken(token);
      return updateReviewCommentShared(session.id, commentId, data);
    },

    async deleteComment(token: string, commentId: string): Promise<{ ok: boolean }> {
      const session = getSessionByToken(token);
      deleteReviewCommentShared(session.id, commentId);
      return { ok: true };
    },

    async sendComments(token: string): Promise<{ sent: number }> {
      const session = getSessionByToken(token);
      const { sent } = batchSendDrafts(session.id, false);
      if (sent > 0 && session.authorEmail) {
        devEmailLog({
          to: session.authorEmail,
          subject: `${session.readerName || 'Un relecteur'} a envoyé ${sent} commentaire${sent > 1 ? 's' : ''} sur « ${session.bookTitle} »`,
          description: 'Notification commentaires relecture',
          details: { 'Relecteur': session.readerName || 'Un relecteur', 'Livre': session.bookTitle, 'Commentaires': `${sent}` },
        });
        createNotification({
          type: 'review_comments_sent',
          actorId: 'reader',
          actorName: session.readerName || 'Un relecteur',
          message: '{{actorName}} a envoyé {{commentCount}} commentaire{{pluralS}} sur « {{bookTitle}} »',
          link: `/reviews/${session.id}`,
          payload: { reviewId: session.id, bookTitle: session.bookTitle, commentCount: `${sent}`, pluralS: sent > 1 ? 's' : '' },
          recipientIds: [session.userId],
        });
      }
      return { sent };
    },

    async complete(token: string): Promise<{ session: ReviewSession }> {
      const session = getSessionByToken(token);
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      saveSession(session);
      if (session.authorEmail) {
        devEmailLog({
          to: session.authorEmail,
          subject: `${session.readerName || 'Un relecteur'} a terminé la relecture de « ${session.bookTitle} »`,
          description: 'Notification relecture terminée',
          details: { 'Relecteur': session.readerName || 'Un relecteur', 'Livre': session.bookTitle },
        });
        createNotification({
          type: 'review_completed',
          actorId: 'reader',
          actorName: session.readerName || 'Un relecteur',
          message: '{{actorName}} a terminé la relecture de « {{bookTitle}} »',
          link: `/reviews/${session.id}`,
          payload: { reviewId: session.id, bookTitle: session.bookTitle },
          recipientIds: [session.userId],
        });
      }
      return { session };
    },
  },
};
