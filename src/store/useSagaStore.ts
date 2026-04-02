import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  SagaProject, Character, Place, Tag, WorldNote, MapItem, MapPin,
  Relationship, KeyEvent,
} from '@/types';
import { generateId, now } from '@/lib/utils';
import { api } from '@/lib/api';
import { useSyncStore } from './useSyncStore';
import { isBase64, uploadImage } from '@/lib/upload';

const shouldSync = () => !!localStorage.getItem('emlb-token');
const IS_DEV = import.meta.env.DEV;

const SAGA_STORAGE_PREFIX = 'fabula-mea-saga-';

export function getSagaStorageKey(sagaId: string): string {
  return `${SAGA_STORAGE_PREFIX}${sagaId}`;
}

async function migrateBase64ImagesSaga(data: SagaProject): Promise<boolean> {
  if (IS_DEV) return false;
  const promises: Promise<void>[] = [];
  let migrated = false;

  for (const char of data.characters) {
    if (char.imageUrl && isBase64(char.imageUrl)) {
      promises.push(uploadImage(char.imageUrl, `char-${char.name}`).then((url) => { char.imageUrl = url; migrated = true; }));
    }
  }
  for (const place of data.places) {
    if (place.imageUrl && isBase64(place.imageUrl)) {
      promises.push(uploadImage(place.imageUrl, `place-${place.name}`).then((url) => { place.imageUrl = url; migrated = true; }));
    }
  }
  for (const note of data.worldNotes) {
    if (note.imageUrl && isBase64(note.imageUrl)) {
      promises.push(uploadImage(note.imageUrl, `world-${note.title}`).then((url) => { note.imageUrl = url; migrated = true; }));
    }
  }
  for (const map of data.maps) {
    if (map.imageUrl && isBase64(map.imageUrl)) {
      promises.push(uploadImage(map.imageUrl, `map-${map.name}`).then((url) => { map.imageUrl = url; migrated = true; }));
    }
  }

  await Promise.all(promises);
  return migrated;
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

        // Save current saga if different
        if (current._loaded && current.id && current.id !== sagaId) {
          localStorage.setItem(
            getSagaStorageKey(current.id),
            JSON.stringify(extractSagaData(current))
          );
        }

        const raw = localStorage.getItem(getSagaStorageKey(sagaId));
        if (raw) {
          const project = JSON.parse(raw) as SagaProject;
          set({ ...project, lastSavedAt: now(), _loaded: true });
        }

        // Async cloud check
        if (shouldSync()) {
          api.sagas.get(sagaId).then((remoteData) => {
            const remote = remoteData as SagaProject;
            const cur = get();
            if (!raw || remote.updatedAt > (cur.updatedAt ?? '')) {
              set({ ...remote, lastSavedAt: now(), _loaded: true });
              localStorage.setItem(getSagaStorageKey(sagaId), JSON.stringify(remote));
            }
          }).catch(() => {
            // Remote not found yet — OK
          });
        }
      },

      saveSaga: () => {
        const state = get();
        if (!state._loaded || !state.id) return;
        const data = extractSagaData(state);
        const json = JSON.stringify(data);

        localStorage.setItem(getSagaStorageKey(state.id), json);
        set({ lastSavedAt: now() });

        if (shouldSync()) {
          const sync = useSyncStore.getState();
          sync.setSyncing();

          migrateBase64ImagesSaga(data).then((didMigrate) => {
            if (didMigrate) {
              set({ ...data, lastSavedAt: now() });
              localStorage.setItem(getSagaStorageKey(state.id), JSON.stringify(data));
            }
            return api.sagas.save(state.id, data);
          })
            .then(() => useSyncStore.getState().setSynced())
            .catch(() => useSyncStore.getState().setError('Échec sync saga'));
        }
      },

      unloadSaga: () => {
        const state = get();
        if (state._loaded && state.id) {
          const data = extractSagaData(state);
          localStorage.setItem(getSagaStorageKey(state.id), JSON.stringify(data));
          if (shouldSync()) {
            api.sagas.save(state.id, data).catch(console.error);
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
        const id = generateId();
        const timestamp = now();
        const newChar: Character = {
          id,
          name: char.name,
          surname: char.surname ?? '',
          nickname: char.nickname ?? '',
          sex: char.sex,
          age: char.age,
          imageUrl: char.imageUrl ?? '',
          imageOffsetY: char.imageOffsetY ?? 50,
          description: char.description ?? '',
          personality: char.personality ?? '',
          qualities: char.qualities ?? [],
          flaws: char.flaws ?? [],
          skills: char.skills ?? [],
          profession: char.profession ?? '',
          lifeGoal: char.lifeGoal ?? '',
          likes: char.likes ?? [],
          dislikes: char.dislikes ?? [],
          keyEvents: char.keyEvents ?? [],
          relationships: char.relationships ?? [],
          evolution: char.evolution ?? { beforeStory: '', duringStory: '', endOfStory: '' },
          tags: char.tags ?? [],
          notes: char.notes ?? '',
          inGlossary: char.inGlossary ?? false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => ({ characters: [...s.characters, newChar], ...touchSave() }));
        return id;
      },

      updateCharacter: (id, data) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: now() } : c
          ),
          ...touchSave(),
        })),

      deleteCharacter: (id) =>
        set((s) => ({
          characters: s.characters.filter((c) => c.id !== id),
          ...touchSave(),
        })),

      addRelationship: (characterId, rel) => {
        const id = generateId();
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, relationships: [...c.relationships, { ...rel, id }], updatedAt: now() }
              : c
          ),
          ...touchSave(),
        }));
      },

      updateRelationship: (characterId, relId, data) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? {
                  ...c,
                  relationships: c.relationships.map((r) =>
                    r.id === relId ? { ...r, ...data } : r
                  ),
                  updatedAt: now(),
                }
              : c
          ),
          ...touchSave(),
        })),

      deleteRelationship: (characterId, relId) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, relationships: c.relationships.filter((r) => r.id !== relId), updatedAt: now() }
              : c
          ),
          ...touchSave(),
        })),

      addKeyEvent: (characterId, event) => {
        const id = generateId();
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, keyEvents: [...c.keyEvents, { ...event, id }], updatedAt: now() }
              : c
          ),
          ...touchSave(),
        }));
      },

      deleteKeyEvent: (characterId, eventId) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, keyEvents: c.keyEvents.filter((e) => e.id !== eventId), updatedAt: now() }
              : c
          ),
          ...touchSave(),
        })),

      // ─── Places ───

      addPlace: (place) => {
        const id = generateId();
        const timestamp = now();
        const newPlace: Place = {
          id,
          name: place.name,
          type: place.type ?? 'other',
          description: place.description ?? '',
          imageUrl: place.imageUrl ?? '',
          inspirations: place.inspirations ?? [],
          connectedPlaceIds: place.connectedPlaceIds ?? [],
          tags: place.tags ?? [],
          notes: place.notes ?? '',
          inGlossary: place.inGlossary ?? false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => ({ places: [...s.places, newPlace], ...touchSave() }));
        return id;
      },

      updatePlace: (id, data) =>
        set((s) => ({
          places: s.places.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: now() } : p
          ),
          ...touchSave(),
        })),

      deletePlace: (id) =>
        set((s) => ({
          places: s.places.filter((p) => p.id !== id),
          ...touchSave(),
        })),

      // ─── Tags ───

      addTag: (tag) => {
        const id = generateId();
        set((s) => ({ tags: [...s.tags, { ...tag, id }], ...touchSave() }));
        return id;
      },

      updateTag: (id, data) =>
        set((s) => ({
          tags: s.tags.map((t) => (t.id === id ? { ...t, ...data } : t)),
          ...touchSave(),
        })),

      deleteTag: (id) =>
        set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          ...touchSave(),
        })),

      // ─── World Notes ───

      addWorldNote: (note) => {
        const id = generateId();
        const timestamp = now();
        const newNote: WorldNote = {
          id,
          title: note.title,
          category: note.category ?? 'custom',
          content: note.content ?? '',
          imageUrl: note.imageUrl ?? '',
          linkedNoteIds: note.linkedNoteIds ?? [],
          tags: note.tags ?? [],
          inGlossary: note.inGlossary ?? false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => ({ worldNotes: [...s.worldNotes, newNote], ...touchSave() }));
        return id;
      },

      updateWorldNote: (id, data) =>
        set((s) => ({
          worldNotes: s.worldNotes.map((n) =>
            n.id === id ? { ...n, ...data, updatedAt: now() } : n
          ),
          ...touchSave(),
        })),

      deleteWorldNote: (id) =>
        set((s) => ({
          worldNotes: s.worldNotes.filter((n) => n.id !== id),
          ...touchSave(),
        })),

      // ─── Maps ───

      addMap: (map) => {
        const id = generateId();
        const timestamp = now();
        const newMap: MapItem = {
          id,
          name: map.name,
          description: map.description ?? '',
          imageUrl: map.imageUrl,
          pins: map.pins ?? [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => ({ maps: [...s.maps, newMap], ...touchSave() }));
        return id;
      },

      updateMap: (id, data) =>
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === id ? { ...m, ...data, updatedAt: now() } : m
          ),
          ...touchSave(),
        })),

      deleteMap: (id) =>
        set((s) => ({
          maps: s.maps.filter((m) => m.id !== id),
          ...touchSave(),
        })),

      addMapPin: (mapId, pin) => {
        const id = generateId();
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId
              ? { ...m, pins: [...m.pins, { ...pin, id }], updatedAt: now() }
              : m
          ),
          ...touchSave(),
        }));
        return id;
      },

      updateMapPin: (mapId, pinId, data) =>
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId
              ? {
                  ...m,
                  pins: m.pins.map((p) => (p.id === pinId ? { ...p, ...data } : p)),
                  updatedAt: now(),
                }
              : m
          ),
          ...touchSave(),
        })),

      deleteMapPin: (mapId, pinId) =>
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId
              ? { ...m, pins: m.pins.filter((p) => p.id !== pinId), updatedAt: now() }
              : m
          ),
          ...touchSave(),
        })),

      // ─── Graph ───

      saveGraphNodePositions: (positions) =>
        set(() => ({ graphNodePositions: positions, ...touchSave() })),
    })
  )
);

// Auto-save on changes (debounced)
let sagaSaveTimeout: ReturnType<typeof setTimeout> | null = null;

useSagaStore.subscribe(
  (s) => s.updatedAt,
  () => {
    if (sagaSaveTimeout) clearTimeout(sagaSaveTimeout);
    sagaSaveTimeout = setTimeout(() => {
      useSagaStore.getState().saveSaga();
    }, 500);
  }
);
