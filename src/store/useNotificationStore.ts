import { create } from 'zustand';
import { api } from '@/lib/api';
import { showLocalNotification } from '@/lib/push';
import { resolveTemplate } from '@/lib/utils';
import type { AppNotification } from '@/types';

interface NotificationStore {
  notifications: AppNotification[];
  readIds: Set<string>;
  isLoading: boolean;

  // Derived helpers
  unreadCount: () => number;
  unreadCountForTicket: (ticketId: string) => number;
  totalUnreadTicketNotifications: () => number;

  // Actions
  loadNotifications: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  markTicketRead: (ticketId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  readIds: new Set<string>(),
  isLoading: false,

  unreadCount: () => {
    const { notifications, readIds } = get();
    return notifications.filter((n) => !readIds.has(n.id)).length;
  },

  unreadCountForTicket: (ticketId: string) => {
    const { notifications, readIds } = get();
    return notifications.filter(
      (n) => n.payload.ticketId === ticketId && !readIds.has(n.id)
    ).length;
  },

  totalUnreadTicketNotifications: () => {
    const { notifications, readIds } = get();
    return notifications.filter(
      (n) => n.type === 'ticket_comment' && !readIds.has(n.id)
    ).length;
  },

  loadNotifications: async () => {
    const token = localStorage.getItem('emlb-token');
    if (!token) return;

    try {
      set({ isLoading: true });
      const prevNotifications = get().notifications;
      const prevReadIds = get().readIds;
      const { notifications, readIds } = await api.notifications.list();
      const newReadIds = new Set(readIds);
      set({ notifications, readIds: newReadIds, isLoading: false });

      // Show local push for new unread notifications (not seen in previous poll)
      if (prevNotifications.length > 0) {
        const prevIds = new Set(prevNotifications.map((n) => n.id));
        const brandNew = notifications.filter((n) => !prevIds.has(n.id) && !newReadIds.has(n.id));
        for (const n of brandNew) {
          const body = resolveTemplate(n.message, { actorName: n.actorName, ...n.payload });
          showLocalNotification('Fabula Mea', body, n.link);
        }
      }
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (notificationId: string) => {
    const { readIds } = get();
    if (readIds.has(notificationId)) return;

    // Optimistic update
    const newReadIds = new Set(readIds);
    newReadIds.add(notificationId);
    set({ readIds: newReadIds });

    try {
      await api.notifications.markRead(notificationId);
    } catch {
      // Revert on error
      const reverted = new Set(get().readIds);
      reverted.delete(notificationId);
      set({ readIds: reverted });
    }
  },

  markAllRead: async () => {
    const { notifications } = get();
    // Optimistic update
    const allIds = new Set(notifications.map((n) => n.id));
    set({ readIds: allIds });

    try {
      await api.notifications.markAllRead();
    } catch {
      // Reload on error
      get().loadNotifications();
    }
  },

  markTicketRead: async (ticketId: string) => {
    const { notifications, readIds } = get();
    const ticketNotifIds = notifications
      .filter((n) => n.payload.ticketId === ticketId)
      .map((n) => n.id);

    if (ticketNotifIds.every((id) => readIds.has(id))) return;

    // Optimistic update
    const newReadIds = new Set(readIds);
    ticketNotifIds.forEach((id) => newReadIds.add(id));
    set({ readIds: newReadIds });

    try {
      await api.notifications.markReadByPayload('ticketId', ticketId);
    } catch {
      get().loadNotifications();
    }
  },
}));
