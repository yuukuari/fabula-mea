import { create } from 'zustand';
import { api, type AuthUser } from '@/lib/api';

interface AuthStore {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  /** Called on app startup — validates stored JWT and restores the session. */
  checkAuth: () => Promise<void>;
  clearError: () => void;
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

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await api.auth.signup({ email, password, name });
      localStorage.setItem('emlb-token', token);
      set({ user, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('emlb-token');
    set({ user: null });
    // Reload to clear all in-memory book state
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
}));
