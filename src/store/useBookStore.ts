import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  BookProject, Character, Place, Chapter, Scene, Tag,
  WritingSession, WorldNote, ExcludedPeriod, ProjectGoals,
  Relationship, KeyEvent, MapItem, MapPin,
} from '@/types';
import { generateId, now, CHAPTER_COLORS } from '@/lib/utils';
import { getBookStorageKey, useLibraryStore } from './useLibraryStore';

interface BookStore extends BookProject {
  lastSavedAt: string | null;
  _loaded: boolean;

  // Lifecycle
  loadBook: (bookId: string) => void;
  saveBook: () => void;
  unloadBook: () => void;
  initNewBook: (bookId: string, title: string, author?: string, genre?: string, writingMode?: import('@/types').WritingMode) => void;
  updateSceneContent: (sceneId: string, content: string, wordCount: number) => void;

  // Project
  updateProject: (data: Partial<Pick<BookProject, 'title' | 'author' | 'genre' | 'synopsis'>>) => void;
  updateWritingMode: (mode: import('@/types').WritingMode, deleteContent: boolean) => void;

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

  // Chapters
  addChapter: (chapter: Partial<Chapter> & { title: string }) => string;
  updateChapter: (id: string, data: Partial<Chapter>) => void;
  deleteChapter: (id: string) => void;
  reorderChapters: (chapterIds: string[]) => void;

  // Scenes
  addScene: (scene: Partial<Scene> & { title: string; chapterId: string }) => string;
  updateScene: (id: string, data: Partial<Scene>) => void;
  deleteScene: (id: string) => void;
  moveScene: (sceneId: string, toChapterId: string, newIndex: number) => void;
  reorderScenes: (chapterId: string, sceneIds: string[]) => void;

  // Tags
  addTag: (tag: Omit<Tag, 'id'>) => string;
  updateTag: (id: string, data: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  // Goals
  updateGoals: (data: Partial<ProjectGoals>) => void;
  addExcludedPeriod: (period: Omit<ExcludedPeriod, 'id'>) => void;
  deleteExcludedPeriod: (id: string) => void;

  // Writing Sessions
  addWritingSession: (session: Omit<WritingSession, 'id'>) => void;
  deleteWritingSession: (id: string) => void;

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

  // Import/Export
  exportProject: () => string;
  importProject: (json: string) => void;
}

function emptyState(): Omit<BookProject, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    author: '',
    genre: '',
    synopsis: '',
    writingMode: 'count',
    characters: [],
    places: [],
    chapters: [],
    scenes: [],
    tags: [],
    goals: {
      defaultWordsPerScene: 500,
      excludedPeriods: [],
    },
    writingSessions: [],
    worldNotes: [],
    maps: [],
  };
}

function extractProjectData(state: BookStore): BookProject {
  return {
    id: state.id,
    title: state.title,
    author: state.author,
    genre: state.genre,
    synopsis: state.synopsis,
    writingMode: state.writingMode,
    characters: state.characters,
    places: state.places,
    chapters: state.chapters,
    scenes: state.scenes,
    tags: state.tags,
    goals: state.goals,
    writingSessions: state.writingSessions,
    worldNotes: state.worldNotes,
    maps: state.maps,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

function touchSave(extra: Record<string, unknown> = {}) {
  const timestamp = now();
  return { ...extra, updatedAt: timestamp, lastSavedAt: timestamp };
}

export const useBookStore = create<BookStore>()(
  subscribeWithSelector(
    (set, get) => ({
      ...emptyState(),
      id: '',
      createdAt: '',
      updatedAt: '',
      lastSavedAt: null,
      _loaded: false,

      // ─── Lifecycle ───
      initNewBook: (bookId, title, author = '', genre = '', writingMode = 'count') => {
        const timestamp = now();
        const newState = {
          ...emptyState(),
          id: bookId,
          title,
          author,
          genre,
          writingMode,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastSavedAt: timestamp,
          _loaded: true,
        };
        set(newState);
        localStorage.setItem(
          getBookStorageKey(bookId),
          JSON.stringify(extractProjectData({ ...newState } as unknown as BookStore))
        );
      },

      loadBook: (bookId) => {
        // Save current book first if loaded
        const current = get();
        if (current._loaded && current.id && current.id !== bookId) {
          localStorage.setItem(
            getBookStorageKey(current.id),
            JSON.stringify(extractProjectData(current))
          );
        }

        const raw = localStorage.getItem(getBookStorageKey(bookId));
        if (raw) {
          const project = JSON.parse(raw) as BookProject;
          set({
            ...project,
            lastSavedAt: now(),
            _loaded: true,
          });
        }
      },

      saveBook: () => {
        const state = get();
        if (!state._loaded || !state.id) return;
        const data = extractProjectData(state);
        localStorage.setItem(getBookStorageKey(state.id), JSON.stringify(data));
        // Also update library meta
        useLibraryStore.getState().updateBookMeta(state.id, {
          title: state.title,
          author: state.author,
          genre: state.genre,
          chaptersCount: state.chapters.length,
          scenesCount: state.scenes.length,
          charactersCount: state.characters.length,
        });
        set({ lastSavedAt: now() });
      },

      unloadBook: () => {
        // Save before unloading
        const state = get();
        if (state._loaded && state.id) {
          localStorage.setItem(getBookStorageKey(state.id), JSON.stringify(extractProjectData(state)));
          useLibraryStore.getState().updateBookMeta(state.id, {
            title: state.title,
            author: state.author,
            genre: state.genre,
            chaptersCount: state.chapters.length,
            scenesCount: state.scenes.length,
            charactersCount: state.characters.length,
          });
        }
        set({
          ...emptyState(),
          id: '',
          createdAt: '',
          updatedAt: '',
          lastSavedAt: null,
          _loaded: false,
        });
      },

      updateProject: (data) =>
        set((s) => ({ ...data, ...touchSave() })),

      updateWritingMode: (mode, deleteContent) =>
        set((s) => ({
          writingMode: mode,
          scenes: s.scenes.map((sc) =>
            deleteContent
              ? { ...sc, content: undefined, currentWordCount: 0, updatedAt: now() }
              : { ...sc, updatedAt: now() }
          ),
          ...touchSave(),
        })),

      // ─── Characters ───
      addCharacter: (char) => {
        const id = generateId();
        const timestamp = now();
        set((s) => ({
          characters: [...s.characters, {
            id,
            name: char.name,
            surname: char.surname ?? '',
            nickname: char.nickname ?? '',
            sex: char.sex,
            age: char.age,
            imageUrl: char.imageUrl ?? '',
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
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          updatedAt: timestamp,
          lastSavedAt: timestamp,
        }));
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
          scenes: s.scenes.map((sc) => ({
            ...sc,
            characterIds: sc.characterIds.filter((cid) => cid !== id),
          })),
          ...touchSave(),
        })),

      addRelationship: (characterId, rel) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, relationships: [...c.relationships, { ...rel, id: generateId() }], updatedAt: now() }
              : c
          ),
          ...touchSave(),
        })),

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

      addKeyEvent: (characterId, event) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, keyEvents: [...c.keyEvents, { ...event, id: generateId() }], updatedAt: now() }
              : c
          ),
          ...touchSave(),
        })),

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
        set((s) => ({
          places: [...s.places, {
            id,
            name: place.name,
            type: place.type ?? 'other',
            description: place.description ?? '',
            imageUrl: place.imageUrl ?? '',
            inspirations: place.inspirations ?? [],
            connectedPlaceIds: place.connectedPlaceIds ?? [],
            tags: place.tags ?? [],
            notes: place.notes ?? '',
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          updatedAt: timestamp,
          lastSavedAt: timestamp,
        }));
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
          scenes: s.scenes.map((sc) =>
            sc.placeId === id ? { ...sc, placeId: undefined } : sc
          ),
          ...touchSave(),
        })),

      // ─── Chapters ───
      addChapter: (chapter) => {
        const id = generateId();
        const timestamp = now();
        set((s) => ({
          chapters: [...s.chapters, {
            id,
            title: chapter.title,
            number: chapter.number ?? s.chapters.length + 1,
            synopsis: chapter.synopsis ?? '',
            sceneIds: [],
            color: chapter.color ?? CHAPTER_COLORS[s.chapters.length % CHAPTER_COLORS.length],
            tags: chapter.tags ?? [],
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          updatedAt: timestamp,
          lastSavedAt: timestamp,
        }));
        return id;
      },

      updateChapter: (id, data) =>
        set((s) => ({
          chapters: s.chapters.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: now() } : c
          ),
          ...touchSave(),
        })),

      deleteChapter: (id) =>
        set((s) => ({
          chapters: s.chapters.filter((c) => c.id !== id),
          scenes: s.scenes.filter((sc) => sc.chapterId !== id),
          ...touchSave(),
        })),

      reorderChapters: (chapterIds) =>
        set((s) => ({
          chapters: chapterIds.map((id, i) => {
            const ch = s.chapters.find((c) => c.id === id)!;
            return { ...ch, number: i + 1 };
          }),
          ...touchSave(),
        })),

      // ─── Scenes ───
      addScene: (scene) => {
        const id = generateId();
        const timestamp = now();
        set((s) => {
          const chapter = s.chapters.find((c) => c.id === scene.chapterId);
          const orderInChapter = chapter ? chapter.sceneIds.length : 0;
          return {
            scenes: [...s.scenes, {
              id,
              title: scene.title,
              description: scene.description ?? '',
              chapterId: scene.chapterId,
              orderInChapter,
              characterIds: scene.characterIds ?? [],
              placeId: scene.placeId,
              startDateTime: scene.startDateTime,
              endDateTime: scene.endDateTime,
              targetWordCount: scene.targetWordCount ?? s.goals.defaultWordsPerScene,
              currentWordCount: scene.currentWordCount ?? 0,
              status: scene.status ?? 'outline',
              tags: scene.tags ?? [],
              notes: scene.notes ?? '',
              createdAt: timestamp,
              updatedAt: timestamp,
            }],
            chapters: s.chapters.map((c) =>
              c.id === scene.chapterId
                ? { ...c, sceneIds: [...c.sceneIds, id], updatedAt: timestamp }
                : c
            ),
            updatedAt: timestamp,
            lastSavedAt: timestamp,
          };
        });
        return id;
      },

      updateScene: (id, data) =>
        set((s) => ({
          scenes: s.scenes.map((sc) =>
            sc.id === id ? { ...sc, ...data, updatedAt: now() } : sc
          ),
          ...touchSave(),
        })),

      updateSceneContent: (sceneId, content, wordCount) =>
        set((s) => ({
          scenes: s.scenes.map((sc) =>
            sc.id === sceneId
              ? { ...sc, content, currentWordCount: wordCount, updatedAt: now() }
              : sc
          ),
          ...touchSave(),
        })),

      deleteScene: (id) =>
        set((s) => ({
          scenes: s.scenes.filter((sc) => sc.id !== id),
          chapters: s.chapters.map((c) => ({
            ...c,
            sceneIds: c.sceneIds.filter((sid) => sid !== id),
          })),
          writingSessions: s.writingSessions.filter((ws) => ws.sceneId !== id),
          ...touchSave(),
        })),

      moveScene: (sceneId, toChapterId, newIndex) =>
        set((s) => {
          const scene = s.scenes.find((sc) => sc.id === sceneId);
          if (!scene) return s;
          const fromChapterId = scene.chapterId;
          const timestamp = now();

          const chapters = s.chapters.map((c) => {
            if (c.id === fromChapterId && c.id !== toChapterId) {
              return { ...c, sceneIds: c.sceneIds.filter((id) => id !== sceneId), updatedAt: timestamp };
            }
            if (c.id === toChapterId && c.id !== fromChapterId) {
              const ids = [...c.sceneIds];
              ids.splice(newIndex, 0, sceneId);
              return { ...c, sceneIds: ids, updatedAt: timestamp };
            }
            if (c.id === fromChapterId && c.id === toChapterId) {
              const ids = c.sceneIds.filter((id) => id !== sceneId);
              ids.splice(newIndex, 0, sceneId);
              return { ...c, sceneIds: ids, updatedAt: timestamp };
            }
            return c;
          });

          const scenes = s.scenes.map((sc) =>
            sc.id === sceneId ? { ...sc, chapterId: toChapterId, updatedAt: timestamp } : sc
          );

          return { chapters, scenes, updatedAt: timestamp, lastSavedAt: timestamp };
        }),

      reorderScenes: (chapterId, sceneIds) =>
        set((s) => ({
          chapters: s.chapters.map((c) =>
            c.id === chapterId ? { ...c, sceneIds, updatedAt: now() } : c
          ),
          scenes: s.scenes.map((sc) => {
            const idx = sceneIds.indexOf(sc.id);
            if (idx >= 0) return { ...sc, orderInChapter: idx };
            return sc;
          }),
          ...touchSave(),
        })),

      // ─── Tags ───
      addTag: (tag) => {
        const id = generateId();
        set((s) => ({
          tags: [...s.tags, { ...tag, id }],
          ...touchSave(),
        }));
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
          characters: s.characters.map((c) => ({
            ...c,
            tags: c.tags.filter((tid) => tid !== id),
          })),
          places: s.places.map((p) => ({
            ...p,
            tags: p.tags.filter((tid) => tid !== id),
          })),
          ...touchSave(),
        })),

      // ─── Goals ───
      updateGoals: (data) =>
        set((s) => ({
          goals: { ...s.goals, ...data },
          ...touchSave(),
        })),

      addExcludedPeriod: (period) =>
        set((s) => ({
          goals: {
            ...s.goals,
            excludedPeriods: [...s.goals.excludedPeriods, { ...period, id: generateId() }],
          },
          ...touchSave(),
        })),

      deleteExcludedPeriod: (id) =>
        set((s) => ({
          goals: {
            ...s.goals,
            excludedPeriods: s.goals.excludedPeriods.filter((p) => p.id !== id),
          },
          ...touchSave(),
        })),

      // ─── Writing Sessions ───
      addWritingSession: (session) =>
        set((s) => ({
          writingSessions: [...s.writingSessions, { ...session, id: generateId() }],
          ...touchSave(),
        })),

      deleteWritingSession: (id) =>
        set((s) => ({
          writingSessions: s.writingSessions.filter((ws) => ws.id !== id),
          ...touchSave(),
        })),

      // ─── World Notes ───
      addWorldNote: (note) => {
        const id = generateId();
        const timestamp = now();
        set((s) => ({
          worldNotes: [...s.worldNotes, {
            id,
            title: note.title,
            category: note.category ?? 'custom',
            content: note.content ?? '',
            imageUrl: note.imageUrl ?? '',
            tags: note.tags ?? [],
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          updatedAt: timestamp,
          lastSavedAt: timestamp,
        }));
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
        set((s) => ({
          maps: [...(s.maps ?? []), {
            id,
            name: map.name,
            description: map.description ?? '',
            imageUrl: map.imageUrl,
            pins: map.pins ?? [],
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          ...touchSave(),
        }));
        return id;
      },

      updateMap: (id, data) =>
        set((s) => ({
          maps: (s.maps ?? []).map((m) =>
            m.id === id ? { ...m, ...data, updatedAt: now() } : m
          ),
          ...touchSave(),
        })),

      deleteMap: (id) =>
        set((s) => ({
          maps: (s.maps ?? []).filter((m) => m.id !== id),
          ...touchSave(),
        })),

      addMapPin: (mapId, pin) => {
        const id = generateId();
        set((s) => ({
          maps: (s.maps ?? []).map((m) =>
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
          maps: (s.maps ?? []).map((m) =>
            m.id === mapId
              ? { ...m, pins: m.pins.map((p) => p.id === pinId ? { ...p, ...data } : p), updatedAt: now() }
              : m
          ),
          ...touchSave(),
        })),

      deleteMapPin: (mapId, pinId) =>
        set((s) => ({
          maps: (s.maps ?? []).map((m) =>
            m.id === mapId
              ? { ...m, pins: m.pins.filter((p) => p.id !== pinId), updatedAt: now() }
              : m
          ),
          ...touchSave(),
        })),

      // ─── Import/Export ───
      exportProject: () => {
        const state = get();
        return JSON.stringify(extractProjectData(state), null, 2);
      },

      importProject: (json) => {
        const project = JSON.parse(json) as BookProject;
        set({
          ...project,
          lastSavedAt: now(),
          _loaded: true,
        });
      },
    })
  )
);

// Auto-save: whenever state changes (debounced), save to localStorage
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
useBookStore.subscribe(
  (state) => state.updatedAt,
  () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      useBookStore.getState().saveBook();
    }, 500);
  }
);
