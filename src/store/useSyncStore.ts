import { create } from 'zustand';
import { isRedisConfigured } from '@/lib/redis';

const IS_DEV = import.meta.env.DEV;

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'synced' | 'error';

interface SyncStore {
  status: SyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  setSyncing: () => void;
  setSynced: () => void;
  setError: (msg?: string) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: (IS_DEV || isRedisConfigured) ? 'idle' : 'disabled',
  lastSyncedAt: null,
  errorMessage: null,
  setSyncing: () => set({ status: 'syncing', errorMessage: null }),
  setSynced:  () => set({ status: 'synced', lastSyncedAt: new Date().toISOString(), errorMessage: null }),
  setError:   (msg) => set({ status: 'error', errorMessage: msg ?? 'Erreur inconnue' }),
}));
