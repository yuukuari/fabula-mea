import { create } from 'zustand';

interface EditorStore {
  /** IDs des scènes ouvertes dans les onglets */
  openSceneIds: string[];
  /** Scène active dans l'éditeur plein écran */
  activeSceneId: string | null;
  /** true = éditeur visible en plein écran */
  isOpen: boolean;

  openScene: (sceneId: string) => void;
  closeScene: (sceneId: string) => void;
  setActiveScene: (sceneId: string) => void;
  minimize: () => void;
  closeAll: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  openSceneIds: [],
  activeSceneId: null,
  isOpen: false,

  openScene: (sceneId) => {
    const { openSceneIds } = get();
    const alreadyOpen = openSceneIds.includes(sceneId);
    set({
      openSceneIds: alreadyOpen ? openSceneIds : [...openSceneIds, sceneId],
      activeSceneId: sceneId,
      isOpen: true,
    });
  },

  closeScene: (sceneId) => {
    const { openSceneIds, activeSceneId } = get();
    const remaining = openSceneIds.filter((id) => id !== sceneId);
    const newActive =
      activeSceneId === sceneId
        ? remaining[remaining.length - 1] ?? null
        : activeSceneId;
    set({
      openSceneIds: remaining,
      activeSceneId: newActive,
      isOpen: remaining.length > 0 && newActive !== null,
    });
  },

  setActiveScene: (sceneId) => set({ activeSceneId: sceneId, isOpen: true }),

  minimize: () => set({ isOpen: false }),

  closeAll: () => set({ openSceneIds: [], activeSceneId: null, isOpen: false }),
}));
