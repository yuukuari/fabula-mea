import { create } from 'zustand';

/**
 * Lightweight global store for the BookReader overlay (mode lecture).
 * Lets any component (e.g. the floating "Mode lecture" pill) toggle it
 * without having to pass open/onClose through props.
 */
interface ReaderStore {
  open: boolean;
  openReader: () => void;
  closeReader: () => void;
  toggleReader: () => void;
}

export const useReaderStore = create<ReaderStore>((set, get) => ({
  open: false,
  openReader: () => set({ open: true }),
  closeReader: () => set({ open: false }),
  toggleReader: () => set({ open: !get().open }),
}));
