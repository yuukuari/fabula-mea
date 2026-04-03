import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Ticket, TicketComment, TicketStatusChange } from '@/types';

interface TicketStore {
  tickets: Ticket[];
  statusChanges: TicketStatusChange[];
  currentTicket: Ticket | null;
  currentComments: TicketComment[];
  currentStatusChanges: TicketStatusChange[];
  isLoading: boolean;
  error: string | null;

  loadTickets: () => Promise<void>;
  loadTicket: (id: string) => Promise<void>;
  createTicket: (data: {
    type: Ticket['type'];
    module?: Ticket['module'];
    title: string;
    description: string;
    visibility: Ticket['visibility'];
  }) => Promise<Ticket>;
  updateTicket: (id: string, data: Partial<Pick<Ticket, 'status' | 'releaseId' | 'type' | 'module'>>) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  addComment: (ticketId: string, content: string) => Promise<void>;
  deleteComment: (ticketId: string, commentId: string) => Promise<void>;
  addReaction: (ticketId: string, commentId: string, emoji: string) => Promise<void>;
  clearError: () => void;
}

export const useTicketStore = create<TicketStore>()((set, get) => ({
  tickets: [],
  statusChanges: [],
  currentTicket: null,
  currentComments: [],
  currentStatusChanges: [],
  isLoading: false,
  error: null,

  loadTickets: async () => {
    set({ isLoading: true, error: null });
    try {
      const { tickets, statusChanges } = await api.tickets.list();
      set({ tickets, statusChanges, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  loadTicket: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { ticket, comments, statusChanges } = await api.tickets.get(id);
      set({
        currentTicket: ticket,
        currentComments: comments,
        currentStatusChanges: statusChanges,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createTicket: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { ticket } = await api.tickets.create(data);
      set((s) => ({ tickets: [...s.tickets, ticket], isLoading: false }));
      return ticket;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  updateTicket: async (id, data) => {
    try {
      const { ticket } = await api.tickets.update(id, data);
      set((s) => ({
        tickets: s.tickets.map((t) => (t.id === id ? ticket : t)),
        currentTicket: s.currentTicket?.id === id ? ticket : s.currentTicket,
      }));
      // Reload ticket to get updated status changes / release assignments / type-module changes
      if (data.status || data.releaseId !== undefined || data.type || data.module !== undefined) {
        get().loadTicket(id);
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteTicket: async (id) => {
    try {
      await api.tickets.delete(id);
      set((s) => ({
        tickets: s.tickets.filter((t) => t.id !== id),
        currentTicket: s.currentTicket?.id === id ? null : s.currentTicket,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  addComment: async (ticketId, content) => {
    try {
      const { comment } = await api.tickets.addComment(ticketId, content);
      set((s) => ({
        currentComments: [...s.currentComments, comment],
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteComment: async (ticketId, commentId) => {
    try {
      await api.tickets.deleteComment(ticketId, commentId);
      set((s) => ({
        currentComments: s.currentComments.filter((c) => c.id !== commentId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  addReaction: async (ticketId, commentId, emoji) => {
    try {
      if (commentId === '__desc__') {
        // Reaction on ticket description — reload the whole ticket
        await api.tickets.addReaction(ticketId, commentId, emoji);
        get().loadTicket(ticketId);
        return;
      }
      const { comment } = await api.tickets.addReaction(ticketId, commentId, emoji);
      set((s) => ({
        currentComments: s.currentComments.map((c) => (c.id === commentId ? comment : c)),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
