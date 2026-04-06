import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface SyncStore {
  status: SyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  setSyncing: () => void;
  setSynced: () => void;
  setError: (msg?: string) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  errorMessage: null,
  setSyncing: () => set({ status: 'syncing', errorMessage: null }),
  setSynced:  () => set({ status: 'synced', lastSyncedAt: new Date().toISOString(), errorMessage: null }),
  setError:   (msg) => set({ status: 'error', errorMessage: msg ?? 'Erreur inconnue' }),
}));
