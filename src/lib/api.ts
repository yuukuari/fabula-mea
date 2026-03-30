/**
 * Client API — toutes les requêtes vers les Vercel serverless functions (/api/*).
 * Le token JWT est stocké dans localStorage sous la clé 'emlb-token'.
 * Les credentials Redis ne sont JAMAIS exposés au client — tout passe par le serveur.
 *
 * En mode développement (Vite `npm run dev`), les endpoints auth sont mockés
 * via dev-auth.ts et stockent les utilisateurs dans localStorage.
 */

import { devAuth } from '@/lib/dev-auth';
import { devDb } from '@/lib/dev-db';
import type { Ticket, TicketComment, TicketStatusChange, Release, ReviewSession, ReviewComment } from '@/types';

const IS_DEV = import.meta.env.DEV;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

function getToken(): string | null {
  return localStorage.getItem('emlb-token');
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    signup: (data: { email: string; password: string; name?: string }) =>
      IS_DEV
        ? devAuth.signup(data)
        : apiFetch<{ token: string; user: AuthUser }>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    login: (data: { email: string; password: string }) =>
      IS_DEV
        ? devAuth.login(data)
        : apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    me: () =>
      IS_DEV
        ? devAuth.me()
        : apiFetch<AuthUser>('/auth/me'),
  },

  library: {
    get: () =>
      IS_DEV ? devDb.library.get() : apiFetch<unknown[]>('/library'),
    save: (books: unknown[]) =>
      IS_DEV
        ? devDb.library.save(books)
        : apiFetch<{ ok: boolean }>('/library', {
            method: 'POST',
            body: JSON.stringify(books),
          }),
  },

  books: {
    get: (bookId: string) =>
      IS_DEV ? devDb.books.get(bookId) : apiFetch<unknown>(`/book/${bookId}`),
    save: (bookId: string, data: unknown) =>
      IS_DEV
        ? devDb.books.save(bookId, data)
        : apiFetch<{ ok: boolean }>(`/book/${bookId}`, {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    delete: (bookId: string) =>
      IS_DEV
        ? devDb.books.delete(bookId)
        : apiFetch<{ ok: boolean }>(`/book/${bookId}`, { method: 'DELETE' }),
    migrate: (data: { library: unknown[]; books: { id: string; data: unknown }[] }) =>
      IS_DEV
        ? devDb.books.migrate(data)
        : apiFetch<{ ok: boolean; migrated: number }>('/migrate', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
  },

  tickets: {
    list: () =>
      IS_DEV
        ? devDb.tickets.list()
        : apiFetch<{ tickets: Ticket[]; statusChanges: TicketStatusChange[] }>('/tickets'),
    create: (data: { type: Ticket['type']; title: string; description: string; visibility: Ticket['visibility'] }) =>
      IS_DEV
        ? devDb.tickets.create(data)
        : apiFetch<{ ticket: Ticket }>('/tickets', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    get: (id: string) =>
      IS_DEV
        ? devDb.tickets.get(id)
        : apiFetch<{ ticket: Ticket; comments: TicketComment[]; statusChanges: TicketStatusChange[] }>(`/tickets/${id}`),
    update: (id: string, data: Partial<Pick<Ticket, 'status' | 'releaseId'>>) =>
      IS_DEV
        ? devDb.tickets.update(id, data)
        : apiFetch<{ ticket: Ticket }>(`/tickets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          }),
    delete: (id: string) =>
      IS_DEV
        ? devDb.tickets.delete(id)
        : apiFetch<{ ok: boolean }>(`/tickets/${id}`, { method: 'DELETE' }),
    addComment: (ticketId: string, content: string) =>
      IS_DEV
        ? devDb.tickets.addComment(ticketId, content)
        : apiFetch<{ comment: TicketComment }>(`/tickets/${ticketId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content }),
          }),
    deleteComment: (ticketId: string, commentId: string) =>
      IS_DEV
        ? devDb.tickets.deleteComment(ticketId, commentId)
        : apiFetch<{ ok: boolean }>(`/tickets/${ticketId}/comments/${commentId}`, { method: 'DELETE' }),
    addReaction: (ticketId: string, commentId: string, emoji: string) =>
      IS_DEV
        ? devDb.tickets.addReaction(ticketId, commentId, emoji)
        : apiFetch<{ comment: TicketComment }>(`/tickets/${ticketId}/comments/${commentId}/reaction`, {
            method: 'POST',
            body: JSON.stringify({ emoji }),
          }),
  },

  releases: {
    list: () =>
      IS_DEV
        ? devDb.releases.list()
        : apiFetch<Release[]>('/releases'),
    get: (id: string) =>
      IS_DEV
        ? devDb.releases.get(id)
        : apiFetch<Release>(`/releases/${id}`),
    create: (data: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>) =>
      IS_DEV
        ? devDb.releases.create(data)
        : apiFetch<{ release: Release }>('/releases', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    update: (id: string, data: Partial<Release>) =>
      IS_DEV
        ? devDb.releases.update(id, data)
        : apiFetch<{ release: Release }>(`/releases/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          }),
    delete: (id: string) =>
      IS_DEV
        ? devDb.releases.delete(id)
        : apiFetch<{ ok: boolean }>(`/releases/${id}`, { method: 'DELETE' }),
  },

  admin: {
    members: () =>
      IS_DEV
        ? devDb.admin.members()
        : apiFetch<{ members: Array<{ id: string; email: string; name: string; isAdmin: boolean; createdAt: string }> }>('/admin/members'),
  },

  // ─── Reviews (author side, authenticated) ────────────────────────────────

  reviews: {
    list: () =>
      IS_DEV
        ? devDb.reviews.list()
        : apiFetch<ReviewSession[]>('/reviews'),
    create: (data: {
      bookId: string;
      bookTitle: string;
      authorName: string;
      authorEmail: string;
      readerEmail?: string;
      snapshot: ReviewSession['snapshot'];
    }) =>
      IS_DEV
        ? devDb.reviews.create(data)
        : apiFetch<{ session: ReviewSession }>('/reviews', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    get: (id: string) =>
      IS_DEV
        ? devDb.reviews.get(id)
        : apiFetch<{ session: ReviewSession; comments: ReviewComment[] }>(`/reviews/${id}`),
    delete: (id: string) =>
      IS_DEV
        ? devDb.reviews.delete(id)
        : apiFetch<{ ok: boolean }>(`/reviews/${id}`, { method: 'DELETE' }),
    closeSession: (id: string) =>
      IS_DEV
        ? devDb.reviews.closeSession(id)
        : apiFetch<{ session: ReviewSession }>(`/reviews/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'closed' }),
          }),
    addComment: (sessionId: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>) =>
      IS_DEV
        ? devDb.reviews.addComment(sessionId, comment)
        : apiFetch<{ comment: ReviewComment }>(`/reviews/${sessionId}/comments`, {
            method: 'POST',
            body: JSON.stringify(comment),
          }),
    updateComment: (sessionId: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>) =>
      IS_DEV
        ? devDb.reviews.updateComment(sessionId, commentId, data)
        : apiFetch<{ comment: ReviewComment }>(`/reviews/${sessionId}/comments/${commentId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          }),
    deleteComment: (sessionId: string, commentId: string) =>
      IS_DEV
        ? devDb.reviews.deleteComment(sessionId, commentId)
        : apiFetch<{ ok: boolean }>(`/reviews/${sessionId}/comments/${commentId}`, { method: 'DELETE' }),
  },

  // ─── Review public (reader side, by token, no auth) ─────────────────────

  reviewPublic: {
    getByToken: (token: string) =>
      IS_DEV
        ? devDb.reviewPublic.getByToken(token)
        : apiFetch<{ session: ReviewSession }>(`/review/${token}`),
    start: (token: string, data: { readerName: string }) =>
      IS_DEV
        ? devDb.reviewPublic.start(token, data)
        : apiFetch<{ session: ReviewSession }>(`/review/${token}/start`, {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    getComments: (token: string) =>
      IS_DEV
        ? devDb.reviewPublic.getComments(token)
        : apiFetch<ReviewComment[]>(`/review/${token}/comments`),
    addComment: (token: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>) =>
      IS_DEV
        ? devDb.reviewPublic.addComment(token, comment)
        : apiFetch<{ comment: ReviewComment }>(`/review/${token}/comments`, {
            method: 'POST',
            body: JSON.stringify(comment),
          }),
    updateComment: (token: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>) =>
      IS_DEV
        ? devDb.reviewPublic.updateComment(token, commentId, data)
        : apiFetch<{ comment: ReviewComment }>(`/review/${token}/comments/${commentId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          }),
    deleteComment: (token: string, commentId: string) =>
      IS_DEV
        ? devDb.reviewPublic.deleteComment(token, commentId)
        : apiFetch<{ ok: boolean }>(`/review/${token}/comments/${commentId}`, { method: 'DELETE' }),
    sendComments: (token: string) =>
      IS_DEV
        ? devDb.reviewPublic.sendComments(token)
        : apiFetch<{ sent: number }>(`/review/${token}/send`, { method: 'POST' }),
    complete: (token: string) =>
      IS_DEV
        ? devDb.reviewPublic.complete(token)
        : apiFetch<{ session: ReviewSession }>(`/review/${token}/complete`, { method: 'POST' }),
  },
};
