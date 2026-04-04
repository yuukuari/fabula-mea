import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Release } from '@/types';

interface ReleaseStore {
  releases: Release[];
  isLoading: boolean;
  error: string | null;
  /** Tracks the last release version the user has seen (stored in localStorage) */
  lastSeenVersion: string | null;
  /** Whether to show the new release modal */
  showNewReleaseModal: boolean;
  newRelease: Release | null;

  loadReleases: () => Promise<void>;
  createRelease: (data: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Release>;
  updateRelease: (id: string, data: Partial<Release>) => Promise<void>;
  deleteRelease: (id: string) => Promise<void>;
  checkNewRelease: () => void;
  dismissNewRelease: () => void;
  getCurrentRelease: () => Release | undefined;
  clearError: () => void;
}

const LAST_SEEN_KEY = 'emlb-last-seen-release';

export const useReleaseStore = create<ReleaseStore>()((set, get) => ({
  releases: [],
  isLoading: false,
  error: null,
  lastSeenVersion: localStorage.getItem(LAST_SEEN_KEY),
  showNewReleaseModal: false,
  newRelease: null,

  loadReleases: async () => {
    set({ isLoading: true, error: null });
    try {
      const releases = await api.releases.list();
      set({ releases, isLoading: false });
      // Check for new release after loading
      get().checkNewRelease();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createRelease: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { release } = await api.releases.create(data);
      set((s) => ({
        releases: [
          ...s.releases.map((r) =>
            data.status === 'current' && r.status === 'current'
              ? { ...r, status: 'released' as const, updatedAt: new Date().toISOString() }
              : r
          ),
          release,
        ],
        isLoading: false,
      }));
      return release;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  updateRelease: async (id, data) => {
    try {
      const { release } = await api.releases.update(id, data);
      set((s) => ({
        releases: s.releases.map((r) => {
          if (r.id === id) return release;
          // Auto-demote: if the updated release is now 'current', demote previous 'current'
          if (data.status === 'current' && r.status === 'current') {
            return { ...r, status: 'released' as const, updatedAt: new Date().toISOString() };
          }
          return r;
        }),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteRelease: async (id) => {
    try {
      await api.releases.delete(id);
      set((s) => ({
        releases: s.releases.filter((r) => r.id !== id),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  checkNewRelease: () => {
    const { releases, lastSeenVersion } = get();
    const current = releases.find((r) => r.status === 'current');
    if (current && current.version !== lastSeenVersion) {
      set({ showNewReleaseModal: true, newRelease: current });
    }
  },

  dismissNewRelease: () => {
    const { newRelease } = get();
    if (newRelease) {
      localStorage.setItem(LAST_SEEN_KEY, newRelease.version);
      set({ showNewReleaseModal: false, lastSeenVersion: newRelease.version });
    }
  },

  getCurrentRelease: () => {
    return get().releases.find((r) => r.status === 'current');
  },

  clearError: () => set({ error: null }),
}));
