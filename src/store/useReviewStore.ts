import { create } from 'zustand';
import { api } from '@/lib/api';
import type { ReviewSession, ReviewComment } from '@/types';

interface ReviewStore {
  // ─── Author side ───
  sessions: ReviewSession[];
  currentSession: ReviewSession | null;
  currentComments: ReviewComment[];
  isLoading: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (data: {
    bookId: string;
    bookTitle: string;
    authorName: string;
    authorEmail: string;
    readerEmail?: string;
    snapshot: ReviewSession['snapshot'];
  }) => Promise<ReviewSession>;
  deleteSession: (id: string) => Promise<void>;
  closeSession: (id: string) => Promise<void>;
  addAuthorComment: (sessionId: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateComment: (sessionId: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>) => Promise<void>;
  deleteComment: (sessionId: string, commentId: string) => Promise<void>;

  // ─── Reader side (by token) ───
  readerSession: ReviewSession | null;
  readerComments: ReviewComment[];
  readerLoading: boolean;

  loadReaderSession: (token: string) => Promise<void>;
  startReaderSession: (token: string, readerName: string) => Promise<void>;
  loadReaderComments: (token: string) => Promise<void>;
  addReaderComment: (token: string, comment: Omit<ReviewComment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateReaderComment: (token: string, commentId: string, data: Partial<Pick<ReviewComment, 'content' | 'status'>>) => Promise<void>;
  deleteReaderComment: (token: string, commentId: string) => Promise<void>;
  sendReaderComments: (token: string) => Promise<number>;
  completeReaderSession: (token: string) => Promise<void>;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  currentComments: [],
  isLoading: false,
  error: null,

  readerSession: null,
  readerComments: [],
  readerLoading: false,

  // ─── Author side ───────────────────────────────────────────────────────

  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await api.reviews.list();
      set({ sessions, isLoading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadSession: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { session, comments } = await api.reviews.get(id);
      set({ currentSession: session, currentComments: comments, isLoading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createSession: async (data) => {
    const { session } = await api.reviews.create(data);
    set((s) => ({ sessions: [...s.sessions, session] }));
    return session;
  },

  deleteSession: async (id: string) => {
    await api.reviews.delete(id);
    set((s) => ({ sessions: s.sessions.filter((r) => r.id !== id) }));
  },

  closeSession: async (id: string) => {
    const { session } = await api.reviews.closeSession(id);
    set((s) => ({
      sessions: s.sessions.map((r) => (r.id === id ? session : r)),
      currentSession: s.currentSession?.id === id ? session : s.currentSession,
    }));
  },

  addAuthorComment: async (sessionId, comment) => {
    const { comment: newComment } = await api.reviews.addComment(sessionId, comment);
    set((s) => ({ currentComments: [...s.currentComments, newComment] }));
  },

  updateComment: async (sessionId, commentId, data) => {
    const { comment: updated } = await api.reviews.updateComment(sessionId, commentId, data);
    set((s) => ({
      currentComments: s.currentComments.map((c) => (c.id === commentId ? updated : c)),
    }));
  },

  deleteComment: async (sessionId, commentId) => {
    await api.reviews.deleteComment(sessionId, commentId);
    set((s) => ({
      currentComments: s.currentComments.filter((c) => c.id !== commentId && c.parentId !== commentId),
    }));
  },

  // ─── Reader side ───────────────────────────────────────────────────────

  loadReaderSession: async (token: string) => {
    set({ readerLoading: true });
    try {
      const { session } = await api.reviewPublic.getByToken(token);
      set({ readerSession: session, readerLoading: false });
    } catch (e: unknown) {
      set({ readerLoading: false, error: (e as Error).message });
    }
  },

  startReaderSession: async (token: string, readerName: string) => {
    const { session } = await api.reviewPublic.start(token, { readerName });
    set({ readerSession: session });
  },

  loadReaderComments: async (token: string) => {
    const comments = await api.reviewPublic.getComments(token);
    set({ readerComments: comments });
  },

  addReaderComment: async (token, comment) => {
    const { comment: newComment } = await api.reviewPublic.addComment(token, comment);
    set((s) => ({ readerComments: [...s.readerComments, newComment] }));
  },

  updateReaderComment: async (token, commentId, data) => {
    const { comment: updated } = await api.reviewPublic.updateComment(token, commentId, data);
    set((s) => ({
      readerComments: s.readerComments.map((c) => (c.id === commentId ? updated : c)),
    }));
  },

  deleteReaderComment: async (token, commentId) => {
    await api.reviewPublic.deleteComment(token, commentId);
    set((s) => ({
      readerComments: s.readerComments.filter((c) => c.id !== commentId && c.parentId !== commentId),
    }));
  },

  sendReaderComments: async (token: string) => {
    const { sent } = await api.reviewPublic.sendComments(token);
    // Refresh comments to get updated statuses
    const comments = await api.reviewPublic.getComments(token);
    set({ readerComments: comments });
    return sent;
  },

  completeReaderSession: async (token: string) => {
    const { session } = await api.reviewPublic.complete(token);
    set({ readerSession: session });
  },
}));
