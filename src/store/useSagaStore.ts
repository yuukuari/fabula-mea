import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  SagaProject, Character, Place, Tag, WorldNote, MapItem, MapPin,
  Relationship, KeyEvent,
} from '@/types';
import { generateId, now } from '@/lib/utils';
import { api } from '@/lib/api';
import { useSyncStore } from './useSyncStore';
import * as enc from './encyclopedia-helpers';
import { migrateEncyclopediaImages } from './encyclopedia-helpers';

const shouldSync = () => !!localStorage.getItem('emlb-token');
const IS_DEV = import.meta.env.DEV;

/** Cloud save with retry (3 attempts, exponential backoff) */
async function cloudSaveWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

const SAGA_STORAGE_PREFIX = 'fabula-mea-saga-';

export function getSagaStorageKey(sagaId: string): string {
  return `${SAGA_STORAGE_PREFIX}${sagaId}`;
}

async function migrateBase64ImagesSaga(data: SagaProject): Promise<boolean> {
  if (IS_DEV) return false;
  return migrateEncyclopediaImages(data);
}

function touchSave(extra: Record<string, unknown> = {}) {
  const timestamp = now();
  return { ...extra, updatedAt: timestamp, lastSavedAt: timestamp };
}

interface SagaStore extends SagaProject {
  lastSavedAt: string | null;
  _loaded: boolean;

  // Lifecycle
  loadSaga: (sagaId: string) => void;
  saveSaga: () => void;
  unloadSaga: () => void;
  initNewSaga: (sagaId: string, title: string, description?: string) => void;
  updateSagaInfo: (data: Partial<Pick<SagaProject, 'title' | 'description' | 'imageUrl'>>) => void;

  // Characters
  addCharacter: (char: Partial<Character> & { name: string }) => string;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  reorderCharacters: (characterIds: string[]) => void;
  addRelationship: (characterId: string, rel: Omit<Relationship, 'id'>) => void;
  updateRelationship: (characterId: string, relId: string, data: Partial<Relationship>) => void;
  deleteRelationship: (characterId: string, relId: string) => void;
  addKeyEvent: (characterId: string, event: Omit<KeyEvent, 'id'>) => void;
  deleteKeyEvent: (characterId: string, eventId: string) => void;

  // Places
  addPlace: (place: Partial<Place> & { name: string }) => string;
  updatePlace: (id: string, data: Partial<Place>) => void;
  deletePlace: (id: string) => void;

  // Tags
  addTag: (tag: Omit<Tag, 'id'>) => string;
  updateTag: (id: string, data: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  // World Notes
  addWorldNote: (note: Partial<WorldNote> & { title: string }) => string;
  updateWorldNote: (id: string, data: Partial<WorldNote>) => void;
  deleteWorldNote: (id: string) => void;

  // Maps
  addMap: (map: Partial<MapItem> & { name: string; imageUrl: string }) => string;
  updateMap: (id: string, data: Partial<MapItem>) => void;
  deleteMap: (id: string) => void;
  addMapPin: (mapId: string, pin: Omit<MapPin, 'id'>) => string;
  updateMapPin: (mapId: string, pinId: string, data: Partial<MapPin>) => void;
  deleteMapPin: (mapId: string, pinId: string) => void;

  // Graph
  saveGraphNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
}

function emptySagaState(): Omit<SagaProject, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    description: '',
    imageUrl: '',
    characters: [],
    places: [],
    worldNotes: [],
    maps: [],
    tags: [],
    graphNodePositions: {},
  };
}

function extractSagaData(state: SagaStore): SagaProject {
  return {
    id: state.id,
    title: state.title,
    description: state.description,
    imageUrl: state.imageUrl,
    characters: state.characters,
    places: state.places,
    worldNotes: state.worldNotes,
    maps: state.maps,
    tags: state.tags,
    graphNodePositions: state.graphNodePositions,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

export const useSagaStore = create<SagaStore>()(
  subscribeWithSelector(
    (set, get) => ({
      ...emptySagaState(),
      id: '',
      createdAt: '',
      updatedAt: '',
      lastSavedAt: null,
      _loaded: false,

      // ─── Lifecycle ───

      initNewSaga: (sagaId, title, description = '') => {
        const timestamp = now();
        const newState = {
          ...emptySagaState(),
          id: sagaId,
          title,
          description,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastSavedAt: timestamp,
          _loaded: true,
        };
        set(newState);
        localStorage.setItem(
          getSagaStorageKey(sagaId),
          JSON.stringify(extractSagaData(newState as unknown as SagaStore))
        );
      },

      loadSaga: (sagaId) => {
        // Don't reload if already loaded
        const current = get();
        if (current._loaded && current.id === sagaId) return;

        cancelPendingSagaSave();

        // Save current saga if different
        if (current._loaded && current.id && current.id !== sagaId) {
          localStorage.setItem(
            getSagaStorageKey(current.id),
            JSON.stringify(extractSagaData(current))
          );
        }

        // 1. Load from localStorage (cache for fast display)
        const raw = localStorage.getItem(getSagaStorageKey(sagaId));
        if (raw) {
          const project = JSON.parse(raw) as SagaProject;
          set({ ...project, lastSavedAt: now(), _loaded: true });
        } else {
          // No local cache — set minimal state so the saga id is tracked
          set({ ...emptySagaState(), id: sagaId, createdAt: '', updatedAt: '', _loaded: true });
        }

        // 2. Fetch from server (source of truth) and apply — but only if user hasn't edited since
        if (shouldSync()) {
          const loadedAt = get().updatedAt;
          api.sagas.get(sagaId).then((remoteData) => {
            const cur = get();
            if (cur.id !== sagaId) return;
            if (cur.updatedAt !== loadedAt) return; // User already edited
            const remote = remoteData as SagaProject;
            set({ ...remote, lastSavedAt: now(), _loaded: true });
            localStorage.setItem(getSagaStorageKey(sagaId), JSON.stringify(remote));
          }).catch(() => {
            // Remote not found yet — use local cache
          });
        }
      },

      saveSaga: () => {
        const state = get();
        if (!state._loaded || !state.id) return;
        const data = extractSagaData(state);
        const json = JSON.stringify(data);

        // Sauvegarde locale (cache)
        localStorage.setItem(getSagaStorageKey(state.id), json);
        set({ lastSavedAt: now() });

        // Sauvegarde cloud (obligatoire avec retry)
        if (shouldSync()) {
          const sagaIdAtSave = state.id;
          useSyncStore.getState().setSyncing();

          migrateBase64ImagesSaga(data).then((didMigrate) => {
            if (didMigrate) {
              const cur = get();
              if (cur.id === sagaIdAtSave && cur._loaded) {
                set({
                  characters: data.characters,
                  places: data.places,
                  worldNotes: data.worldNotes,
                  maps: data.maps,
                });
                const fresh = extractSagaData(get());
                localStorage.setItem(getSagaStorageKey(sagaIdAtSave), JSON.stringify(fresh));
                return cloudSaveWithRetry(() => api.sagas.save(sagaIdAtSave, fresh));
              }
            }
            return cloudSaveWithRetry(() => api.sagas.save(sagaIdAtSave, data));
          })
            .then(() => {
              if (get().id === sagaIdAtSave) useSyncStore.getState().setSynced();
            })
            .catch((err) => {
              if (IS_DEV) console.error('Cloud save saga failed after retries:', err);
              if (get().id === sagaIdAtSave) useSyncStore.getState().setError('Échec de la sauvegarde en ligne');
            });
        }
      },

      unloadSaga: () => {
        cancelPendingSagaSave();
        const state = get();

        if (state._loaded && state.id) {
          const data = extractSagaData(state);
          localStorage.setItem(getSagaStorageKey(state.id), JSON.stringify(data));
          if (shouldSync()) {
            cloudSaveWithRetry(() => api.sagas.save(state.id, data))
              .catch(() => useSyncStore.getState().setError('Échec de la sauvegarde en ligne'));
          }
        }
        set({
          ...emptySagaState(),
          id: '',
          createdAt: '',
          updatedAt: '',
          lastSavedAt: null,
          _loaded: false,
        });
      },

      updateSagaInfo: (data) =>
        set(() => ({ ...data, ...touchSave() })),

      // ─── Characters ───

      addCharacter: (char) => {
        const { characters, id } = enc.createCharacter(get().characters, char);
        set(() => ({ characters, ...touchSave() }));
        return id;
      },
      updateCharacter: (id, data) =>
        set((s) => ({ characters: enc.updateCharacter(s.characters, id, data), ...touchSave() })),
      deleteCharacter: (id) =>
        set((s) => ({ characters: enc.deleteCharacter(s.characters, id), ...touchSave() })),
      reorderCharacters: (characterIds) =>
        set((s) => ({ characters: enc.reorderCharacters(s.characters, characterIds), ...touchSave() })),
      addRelationship: (characterId, rel) =>
        set((s) => ({ characters: enc.addRelationship(s.characters, characterId, rel), ...touchSave() })),
      updateRelationship: (characterId, relId, data) =>
        set((s) => ({ characters: enc.updateRelationship(s.characters, characterId, relId, data), ...touchSave() })),
      deleteRelationship: (characterId, relId) =>
        set((s) => ({ characters: enc.deleteRelationship(s.characters, characterId, relId), ...touchSave() })),
      addKeyEvent: (characterId, event) =>
        set((s) => ({ characters: enc.addKeyEvent(s.characters, characterId, event), ...touchSave() })),
      deleteKeyEvent: (characterId, eventId) =>
        set((s) => ({ characters: enc.deleteKeyEvent(s.characters, characterId, eventId), ...touchSave() })),

      // ─── Places ───

      addPlace: (place) => {
        const { places, id } = enc.createPlace(get().places, place);
        set(() => ({ places, ...touchSave() }));
        return id;
      },
      updatePlace: (id, data) =>
        set((s) => ({ places: enc.updatePlace(s.places, id, data), ...touchSave() })),
      deletePlace: (id) =>
        set((s) => ({ places: enc.deletePlace(s.places, id), ...touchSave() })),

      // ─── Tags ───

      addTag: (tag) => {
        const { tags, id } = enc.createTag(get().tags, tag);
        set(() => ({ tags, ...touchSave() }));
        return id;
      },
      updateTag: (id, data) =>
        set((s) => ({ tags: enc.updateTag(s.tags, id, data), ...touchSave() })),
      deleteTag: (id) =>
        set((s) => ({ tags: enc.deleteTag(s.tags, id), ...touchSave() })),

      // ─── World Notes ───

      addWorldNote: (note) => {
        const { worldNotes, id } = enc.createWorldNote(get().worldNotes, note);
        set(() => ({ worldNotes, ...touchSave() }));
        return id;
      },
      updateWorldNote: (id, data) =>
        set((s) => ({ worldNotes: enc.updateWorldNote(s.worldNotes, id, data), ...touchSave() })),
      deleteWorldNote: (id) =>
        set((s) => ({ worldNotes: enc.deleteWorldNote(s.worldNotes, id), ...touchSave() })),

      // ─── Maps ───

      addMap: (map) => {
        const { maps, id } = enc.createMap(get().maps, map);
        set(() => ({ maps, ...touchSave() }));
        return id;
      },
      updateMap: (id, data) =>
        set((s) => ({ maps: enc.updateMap(s.maps, id, data), ...touchSave() })),
      deleteMap: (id) =>
        set((s) => ({ maps: enc.deleteMap(s.maps, id), ...touchSave() })),
      addMapPin: (mapId, pin) => {
        const { maps, id } = enc.addMapPin(get().maps, mapId, pin);
        set(() => ({ maps, ...touchSave() }));
        return id;
      },
      updateMapPin: (mapId, pinId, data) =>
        set((s) => ({ maps: enc.updateMapPin(s.maps, mapId, pinId, data), ...touchSave() })),
      deleteMapPin: (mapId, pinId) =>
        set((s) => ({ maps: enc.deleteMapPin(s.maps, mapId, pinId), ...touchSave() })),

      // ─── Graph ───

      saveGraphNodePositions: (positions) =>
        set(() => ({ graphNodePositions: positions, ...touchSave() })),
    })
  )
);

// Auto-save on changes (debounced)
let sagaSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function cancelPendingSagaSave(): void {
  if (sagaSaveTimeout) { clearTimeout(sagaSaveTimeout); sagaSaveTimeout = null; }
}

useSagaStore.subscribe(
  (s) => s.updatedAt,
  () => {
    if (sagaSaveTimeout) clearTimeout(sagaSaveTimeout);
    sagaSaveTimeout = setTimeout(() => {
      useSagaStore.getState().saveSaga();
    }, 500);
  }
);

