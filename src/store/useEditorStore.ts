import { create } from 'zustand';

interface EditorStore {
  /** Un seul onglet à la fois — l'ID de la scène de départ (pour scroll initial) */
  entrySceneId: string | null;
  /** true = éditeur split-panel visible */
  isOpen: boolean;

  open: (sceneId: string) => void;
  close: () => void;
  minimize: () => void;
  /** Set the entry scene (show tab) without opening the editor */
  setEntryScene: (sceneId: string) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  entrySceneId: null,
  isOpen: false,

  open: (sceneId) => set({ entrySceneId: sceneId, isOpen: true }),
  close: () => set({ entrySceneId: null, isOpen: false }),
  minimize: () => set({ isOpen: false }),
  setEntryScene: (sceneId) => set({ entrySceneId: sceneId, isOpen: false }),
}));
