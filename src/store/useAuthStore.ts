import { create } from 'zustand';
import { api, type AuthUser } from '@/lib/api';

interface AuthStore {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string, captchaToken?: string) => Promise<void>;
  logout: () => void;
  /** Called on app startup — validates stored JWT and restores the session. */
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: { name?: string; email?: string; avatarUrl?: string; avatarOffsetY?: number }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await api.auth.login({ email, password });
      localStorage.setItem('emlb-token', token);
      set({ user, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  signup: async (email, password, name, captchaToken) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await api.auth.signup({ email, password, name, captchaToken });
      localStorage.setItem('emlb-token', token);
      set({ user, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('emlb-token');
    // Clear Zustand persisted data so next user starts clean
    localStorage.removeItem('fabula-mea-library');
    // Clear all cached book data
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('fabula-mea-book-')) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    set({ user: null });
    // Reload to clear all in-memory state
    window.location.href = '/';
  },

  checkAuth: async () => {
    const token = localStorage.getItem('emlb-token');
    if (!token) return;
    try {
      const user = await api.auth.me();
      set({ user });
    } catch {
      // Token invalid/expired — clear it
      localStorage.removeItem('emlb-token');
    }
  },

  clearError: () => set({ error: null }),

  updateProfile: async (data) => {
    const user = await api.auth.updateProfile(data);
    set({ user });
  },

  changePassword: async (currentPassword, newPassword) => {
    await api.auth.changePassword({ currentPassword, newPassword });
  },

  deleteAccount: async () => {
    await api.auth.deleteAccount();
    localStorage.removeItem('emlb-token');
    localStorage.removeItem('fabula-mea-library');
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('fabula-mea-book-')) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    set({ user: null });
    window.location.href = '/';
  },
}));
