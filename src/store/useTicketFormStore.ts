import { create } from 'zustand';

interface TicketFormStore {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useTicketFormStore = create<TicketFormStore>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
