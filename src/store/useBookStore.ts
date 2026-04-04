import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  BookProject, Character, Place, Chapter, Scene, Tag,
  WritingSession, WorldNote, ExcludedPeriod, ProjectGoals,
  Relationship, KeyEvent, MapItem, MapPin, SelfComment, NoteIdea,
  BookLayout, TimelineEvent, EventDuration, DurationUnit,
} from '@/types';
import { generateId, now, CHAPTER_COLORS, FRONT_MATTER_LABEL, BACK_MATTER_LABEL, FRONT_MATTER_NUMBER, BACK_MATTER_NUMBER, SPECIAL_CHAPTER_COLOR, computeEventEndDate, getEventStartDate } from '@/lib/utils';
import { getBookStorageKey, useLibraryStore } from './useLibraryStore';
import { api } from '@/lib/api';
import { useSyncStore } from './useSyncStore';
import { useSagaStore } from './useSagaStore';
import { isBase64, uploadImage } from '@/lib/upload';
import { migrateScenesToTimelineEvents } from '@/lib/migration';

const shouldSync = () => !!localStorage.getItem('emlb-token');

const IS_DEV = import.meta.env.DEV;

/**
 * Migrate base64 images to CDN URLs in a BookProject.
 * Mutates the project data in-place and returns true if any migration occurred.
 */
async function migrateBase64Images(data: BookProject): Promise<boolean> {
  // In dev mode, skip migration (no CDN available)
  if (IS_DEV) return false;

  const promises: Promise<void>[] = [];
  let migrated = false;

  // Characters
  for (const char of data.characters) {
    const img = char.imageUrl;
    if (img && isBase64(img)) {
      promises.push(uploadImage(img, `char-${char.name}`).then((url) => { char.imageUrl = url; migrated = true; }));
    }
  }

  // Places
  for (const place of data.places) {
    const img = place.imageUrl;
    if (img && isBase64(img)) {
      promises.push(uploadImage(img, `place-${place.name}`).then((url) => { place.imageUrl = url; migrated = true; }));
    }
  }

  // World Notes
  for (const note of data.worldNotes) {
    const img = note.imageUrl;
    if (img && isBase64(img)) {
      promises.push(uploadImage(img, `world-${note.title}`).then((url) => { note.imageUrl = url; migrated = true; }));
    }
  }

  // Maps
  for (const map of (data.maps ?? [])) {
    const img = map.imageUrl;
    if (img && isBase64(img)) {
      promises.push(uploadImage(img, `map-${map.name}`).then((url) => { map.imageUrl = url; migrated = true; }));
    }
  }

  // Layout covers
  if (data.layout?.coverFront && isBase64(data.layout.coverFront)) {
    promises.push(uploadImage(data.layout.coverFront, 'cover-front').then((url) => { data.layout!.coverFront = url; migrated = true; }));
  }
  if (data.layout?.coverBack && isBase64(data.layout.coverBack)) {
    promises.push(uploadImage(data.layout.coverBack, 'cover-back').then((url) => { data.layout!.coverBack = url; migrated = true; }));
  }

  await Promise.all(promises);
  return migrated;
}

interface BookStore extends BookProject {
  lastSavedAt: string | null;
  _loaded: boolean;

  // Lifecycle
  loadBook: (bookId: string) => void;
  saveBook: () => void;
  unloadBook: () => void;
  initNewBook: (bookId: string, title: string, author?: string, genre?: string, writingMode?: import('@/types').WritingMode, countUnit?: import('@/types').CountUnit, sagaId?: string, layout?: import('@/types').BookLayout) => void;
  updateSceneContent: (sceneId: string, content: string, wordCount: number) => void;

  // Project
  updateProject: (data: Partial<Pick<BookProject, 'title' | 'author' | 'genre' | 'synopsis'>>) => void;
  updateWritingMode: (mode: import('@/types').WritingMode, deleteContent: boolean) => void;
  updateCountUnit: (unit: import('@/types').CountUnit) => void;
  setGlossaryEnabled: (enabled: boolean) => void;
  setTableOfContents: (enabled: boolean) => void;
  updateLayout: (data: Partial<BookLayout>) => void;

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
  addChapter: (chapter: Partial<Chapter>) => string;
  updateChapter: (id: string, data: Partial<Chapter>) => void;
  deleteChapter: (id: string) => void;
  reorderChapters: (chapterIds: string[]) => void;

  // Scenes
  addScene: (scene: Partial<Scene> & { chapterId: string }) => string;
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

  // Self-comments
  addSelfComment: (comment: Omit<SelfComment, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateSelfComment: (id: string, data: Partial<Pick<SelfComment, 'content'>>) => void;
  deleteSelfComment: (id: string) => void;

  // Note Ideas
  addNoteIdea: (note: Partial<NoteIdea> & { title: string }) => string;
  updateNoteIdea: (id: string, data: Partial<NoteIdea>) => void;
  deleteNoteIdea: (id: string) => void;
  reorderNoteIdeas: (noteIds: string[]) => void;

  // Timeline Events
  addTimelineEvent: (event: Partial<TimelineEvent> & { title: string; startDate: string; duration: EventDuration }) => string;
  updateTimelineEvent: (id: string, data: Partial<TimelineEvent>) => void;
  deleteTimelineEvent: (id: string) => void;
  reorderTimelineEvents: (eventIds: string[]) => void;
  insertTimelineEvent: (referenceId: string, position: 'before' | 'after', event: Partial<TimelineEvent> & { title: string; duration: EventDuration }) => string;
  splitTimelineEvent: (id: string, splitPoints: number[], unit: DurationUnit) => void;
  linkEventToScene: (eventId: string, chapterId: string, sceneId: string) => void;
  unlinkEventFromScene: (eventId: string) => void;
  convertEventToChapter: (eventId: string) => string;
  createSceneForEvent: (eventId: string, chapterId: string) => string;

  // Graph node positions
  saveGraphNodePositions: (positions: Record<string, { x: number; y: number }>) => void;

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
    countUnit: undefined,
    sagaId: undefined,
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
    timelineEvents: [],
    noteIdeas: [],
    selfComments: [],
    graphNodePositions: {},
    glossaryEnabled: false,
    tableOfContents: undefined,
    layout: {
      fontFamily: 'Times New Roman',
      fontSize: 12,
      lineHeight: 1.5,
    },
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
    countUnit: state.countUnit,
    sagaId: state.sagaId,
    characters: state.characters,
    places: state.places,
    chapters: state.chapters,
    scenes: state.scenes,
    tags: state.tags,
    goals: state.goals,
    writingSessions: state.writingSessions,
    worldNotes: state.worldNotes,
    maps: state.maps,
    timelineEvents: state.timelineEvents,
    noteIdeas: state.noteIdeas,
    selfComments: state.selfComments,
    graphNodePositions: state.graphNodePositions,
    glossaryEnabled: state.glossaryEnabled,
    tableOfContents: state.tableOfContents,
    layout: state.layout,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

function touchSave(extra: Record<string, unknown> = {}) {
  const timestamp = now();
  return { ...extra, updatedAt: timestamp, lastSavedAt: timestamp };
}

/** Ensure a book has front_matter and back_matter chapters (migration for existing books) */
function ensureSpecialChapters(project: BookProject): BookProject {
  const hasFront = project.chapters.some(c => c.type === 'front_matter');
  const hasBack = project.chapters.some(c => c.type === 'back_matter');
  if (hasFront && hasBack) return project;

  const timestamp = now();
  const newChapters = [...project.chapters];

  if (!hasFront) {
    newChapters.push({
      id: generateId(),
      title: FRONT_MATTER_LABEL,
      number: FRONT_MATTER_NUMBER,
      type: 'front_matter',
      synopsis: '',
      sceneIds: [],
      color: SPECIAL_CHAPTER_COLOR,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  if (!hasBack) {
    newChapters.push({
      id: generateId(),
      title: BACK_MATTER_LABEL,
      number: BACK_MATTER_NUMBER,
      type: 'back_matter',
      synopsis: '',
      sceneIds: [],
      color: SPECIAL_CHAPTER_COLOR,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return { ...project, chapters: newChapters };
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
      initNewBook: (bookId, title, author = '', genre = '', writingMode = 'count', countUnit = 'words', sagaId, layout) => {
        const timestamp = now();
        const newState = {
          ...emptyState(),
          id: bookId,
          title,
          author,
          genre,
          writingMode,
          countUnit,
          sagaId,
          ...(layout ? { layout } : {}),
          chapters: [
            {
              id: generateId(),
              title: FRONT_MATTER_LABEL,
              number: FRONT_MATTER_NUMBER,
              type: 'front_matter' as const,
              synopsis: '',
              sceneIds: [] as string[],
              color: SPECIAL_CHAPTER_COLOR,
              tags: [] as string[],
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: generateId(),
              title: BACK_MATTER_LABEL,
              number: BACK_MATTER_NUMBER,
              type: 'back_matter' as const,
              synopsis: '',
              sceneIds: [] as string[],
              color: SPECIAL_CHAPTER_COLOR,
              tags: [] as string[],
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
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
          const project = migrateScenesToTimelineEvents(ensureSpecialChapters(JSON.parse(raw) as BookProject));
          set({ ...emptyState(), ...project, lastSavedAt: now(), _loaded: true });
          // Load saga if this book belongs to one
          if (project.sagaId) {
            useSagaStore.getState().loadSaga(project.sagaId);
          } else {
            useSagaStore.getState().unloadSaga();
          }
        }

        // Vérifie l'API de façon asynchrone (priorité si plus récent ou si localStorage vide)
        if (shouldSync()) {
          api.books.get(bookId).then((remoteData) => {
            const remote = remoteData as BookProject;
            const cur = get();
            if (!raw || remote.updatedAt > (cur.updatedAt ?? '')) {
              const migrated = migrateScenesToTimelineEvents(ensureSpecialChapters(remote));
              set({ ...emptyState(), ...migrated, lastSavedAt: now(), _loaded: true });
              localStorage.setItem(getBookStorageKey(bookId), JSON.stringify(migrated));
              // Load saga from remote data if needed
              if (migrated.sagaId) {
                useSagaStore.getState().loadSaga(migrated.sagaId);
              }
            }
            useSyncStore.getState().setSynced();
          }).catch(() => {
            // Remote not found yet (new book) — that's OK
            if (raw) useSyncStore.getState().setSynced();
          });
        }
      },

      saveBook: () => {
        const state = get();
        if (!state._loaded || !state.id) return;
        const data = extractProjectData(state);
        const json = JSON.stringify(data);

        // Sauvegarde locale (immédiate)
        localStorage.setItem(getBookStorageKey(state.id), json);
        useLibraryStore.getState().updateBookMeta(state.id, {
          title: state.title,
          author: state.author,
          genre: state.genre,
          chaptersCount: state.chapters.filter(c => (c.type ?? 'chapter') === 'chapter').length,
          scenesCount: state.scenes.length,
          charactersCount: state.characters.length,
        });
        set({ lastSavedAt: now() });

        // Sauvegarde cloud (asynchrone) — migrate base64 images first
        if (shouldSync()) {
          const sync = useSyncStore.getState();
          sync.setSyncing();

          migrateBase64Images(data).then((didMigrate) => {
            if (didMigrate) {
              // Update store and localStorage with migrated URLs
              set({ ...data, lastSavedAt: now() });
              localStorage.setItem(getBookStorageKey(state.id), JSON.stringify(data));
            }
            return api.books.save(state.id, data);
          })
            .then(() => useSyncStore.getState().setSynced())
            .catch(() => useSyncStore.getState().setError('Échec sync cloud'));
        }
      },

      unloadBook: () => {
        // Save before unloading
        const state = get();
        if (state._loaded && state.id) {
          const projectData = extractProjectData(state);
          const json = JSON.stringify(projectData);
          localStorage.setItem(getBookStorageKey(state.id), json);
          if (shouldSync()) {
            api.books.save(state.id, projectData).catch(console.error);
          }
          useLibraryStore.getState().updateBookMeta(state.id, {
            title: state.title,
            author: state.author,
            genre: state.genre,
            chaptersCount: state.chapters.length,
            scenesCount: state.scenes.length,
            charactersCount: state.characters.length,
          });
        }
        // Unload saga too
        useSagaStore.getState().unloadSaga();
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

      updateCountUnit: (unit) =>
        set((s) => ({
          countUnit: unit,
          ...touchSave(),
        })),

      setGlossaryEnabled: (enabled) =>
        set((s) => ({
          glossaryEnabled: enabled,
          ...touchSave(),
        })),

      setTableOfContents: (enabled) =>
        set((s) => ({
          tableOfContents: enabled,
          ...touchSave(),
        })),

      updateLayout: (data) =>
        set((s) => ({
          layout: { ...(s.layout ?? { fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.5 }), ...data },
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
            inGlossary: char.inGlossary ?? false,
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
            inGlossary: place.inGlossary ?? false,
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
        set((s) => {
          const regularChapters = s.chapters.filter(c => (c.type ?? 'chapter') === 'chapter');
          return {
            chapters: [...s.chapters, {
              id,
              title: chapter.title ?? '',
              number: chapter.number ?? regularChapters.length + 1,
              type: 'chapter' as const,
              synopsis: chapter.synopsis ?? '',
              sceneIds: [],
              color: chapter.color ?? CHAPTER_COLORS[regularChapters.length % CHAPTER_COLORS.length],
              tags: chapter.tags ?? [],
              createdAt: timestamp,
              updatedAt: timestamp,
            }],
            updatedAt: timestamp,
            lastSavedAt: timestamp,
          };
        });
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
        set((s) => {
          const ch = s.chapters.find(c => c.id === id);
          // Cannot delete front/back matter
          if (ch && (ch.type === 'front_matter' || ch.type === 'back_matter')) return {};
          return {
            chapters: s.chapters.filter((c) => c.id !== id),
            scenes: s.scenes.filter((sc) => sc.chapterId !== id),
            ...touchSave(),
          };
        }),

      reorderChapters: (chapterIds) =>
        set((s) => {
          const specialChapters = s.chapters.filter(c => c.type === 'front_matter' || c.type === 'back_matter');
          const reordered = chapterIds.map((id, i) => {
            const ch = s.chapters.find((c) => c.id === id)!;
            return { ...ch, number: i + 1 };
          });
          return {
            chapters: [...specialChapters, ...reordered],
            ...touchSave(),
          };
        }),

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
              title: scene.title ?? '',
              description: scene.description ?? '',
              chapterId: scene.chapterId,
              orderInChapter,
              characterIds: scene.characterIds ?? [],
              placeId: scene.placeId,
              startDate: scene.startDate,
              startTime: scene.startTime,
              duration: scene.duration,
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

      updateScene: (id, data) => {
        const state = get();
        const temporalChanged = data.startDate !== undefined || data.startTime !== undefined || data.duration !== undefined;

        // Find linked timeline event (event.sceneId === this scene's id)
        const linkedEvent = temporalChanged
          ? (state.timelineEvents ?? []).find((e) => e.sceneId === id)
          : null;

        set((s) => {
          const newScenes = s.scenes.map((sc) =>
            sc.id === id ? { ...sc, ...data, updatedAt: now() } : sc
          );

          // Sync temporal data to linked event
          const newTimelineEvents = linkedEvent
            ? (s.timelineEvents ?? []).map((e) =>
                e.id === linkedEvent.id
                  ? {
                      ...e,
                      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
                      ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
                      ...(data.duration !== undefined ? { duration: data.duration } : {}),
                      updatedAt: now(),
                    }
                  : e
              )
            : s.timelineEvents;

          return { scenes: newScenes, timelineEvents: newTimelineEvents, ...touchSave() };
        });
      },

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
            linkedNoteIds: note.linkedNoteIds ?? [],
            tags: note.tags ?? [],
            inGlossary: note.inGlossary ?? false,
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

      // ─── Self-comments ───
      addSelfComment: (comment) => {
        const id = generateId();
        const timestamp = now();
        set((s) => ({
          selfComments: [...(s.selfComments ?? []), { ...comment, id, createdAt: timestamp, updatedAt: timestamp }],
          ...touchSave(),
        }));
        return id;
      },

      updateSelfComment: (id, data) =>
        set((s) => ({
          selfComments: (s.selfComments ?? []).map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: now() } : c
          ),
          ...touchSave(),
        })),

      deleteSelfComment: (id) =>
        set((s) => ({
          selfComments: (s.selfComments ?? []).filter((c) => c.id !== id),
          ...touchSave(),
        })),

      // ─── Note Ideas ───
      addNoteIdea: (note) => {
        const id = generateId();
        const timestamp = now();
        set((s) => ({
          noteIdeas: [...(s.noteIdeas ?? []), {
            id,
            title: note.title,
            content: note.content ?? '',
            order: (s.noteIdeas ?? []).length,
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          ...touchSave(),
        }));
        return id;
      },

      updateNoteIdea: (id, data) =>
        set((s) => ({
          noteIdeas: (s.noteIdeas ?? []).map((n) =>
            n.id === id ? { ...n, ...data, updatedAt: now() } : n
          ),
          ...touchSave(),
        })),

      deleteNoteIdea: (id) =>
        set((s) => ({
          noteIdeas: (s.noteIdeas ?? []).filter((n) => n.id !== id),
          ...touchSave(),
        })),

      reorderNoteIdeas: (noteIds) =>
        set((s) => ({
          noteIdeas: noteIds.map((id, i) => {
            const note = (s.noteIdeas ?? []).find((n) => n.id === id)!;
            return { ...note, order: i };
          }),
          ...touchSave(),
        })),

      // ─── Timeline Events ───
      addTimelineEvent: (event) => {
        const id = generateId();
        const timestamp = now();
        const events = get().timelineEvents ?? [];
        const maxOrder = events.length > 0 ? Math.max(...events.map((e) => e.order)) + 1 : 0;
        const newEvent: TimelineEvent = {
          id,
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          startTime: event.startTime,
          duration: event.duration,
          order: event.order ?? maxOrder,
          characterIds: event.characterIds ?? [],
          placeId: event.placeId,
          chapterId: event.chapterId,
          sceneId: event.sceneId,
          tags: event.tags ?? [],
          notes: event.notes,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => ({
          timelineEvents: [...(s.timelineEvents ?? []), newEvent],
          ...touchSave(),
        }));
        return id;
      },

      updateTimelineEvent: (id, data) => {
        const state = get();
        const event = (state.timelineEvents ?? []).find((e) => e.id === id);
        if (!event) return;

        // If this event is linked to a scene and temporal data changed, sync to the scene
        const updatedEvent = { ...event, ...data };
        const temporalChanged = data.startDate !== undefined || data.startTime !== undefined || data.duration !== undefined;
        const sceneId = data.sceneId !== undefined ? data.sceneId : event.sceneId;

        set((s) => {
          const newTimelineEvents = (s.timelineEvents ?? []).map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: now() } : e
          );
          // Sync temporal data to linked scene
          const newScenes = (temporalChanged && sceneId)
            ? s.scenes.map((sc) =>
                sc.id === sceneId
                  ? {
                      ...sc,
                      startDate: updatedEvent.startDate,
                      startTime: updatedEvent.startTime,
                      duration: updatedEvent.duration,
                      startDateTime: undefined,
                      endDateTime: undefined,
                      updatedAt: now(),
                    }
                  : sc
              )
            : s.scenes;
          return { timelineEvents: newTimelineEvents, scenes: newScenes, ...touchSave() };
        });
      },

      deleteTimelineEvent: (id) =>
        set((s) => ({
          timelineEvents: (s.timelineEvents ?? []).filter((e) => e.id !== id),
          ...touchSave(),
        })),

      reorderTimelineEvents: (eventIds) =>
        set((s) => ({
          timelineEvents: eventIds
            .map((id, i) => {
              const evt = (s.timelineEvents ?? []).find((e) => e.id === id);
              return evt ? { ...evt, order: i } : null;
            })
            .filter(Boolean) as TimelineEvent[],
          ...touchSave(),
        })),

      insertTimelineEvent: (referenceId, position, event) => {
        const id = generateId();
        const timestamp = now();
        const events = [...(get().timelineEvents ?? [])].sort((a, b) => a.order - b.order);
        const refIndex = events.findIndex((e) => e.id === referenceId);
        if (refIndex === -1) return id;

        const refEvent = events[refIndex];
        let startDate: string;
        let startTime: string | undefined;

        const toDateStr = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const toTimeStr = (d: Date) =>
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        // Hours-based events always need a startTime; others only if ref had one
        const needsTime = refEvent.duration.unit === 'hours' || event.duration.unit === 'hours' || !!refEvent.startTime;

        if (position === 'after') {
          // New event starts right after reference event ends
          const endDate: Date = computeEventEndDate(refEvent.startDate, refEvent.startTime, refEvent.duration);
          startDate = toDateStr(endDate);
          startTime = needsTime ? toTimeStr(endDate) : undefined;
        } else {
          // New event ends right when reference event starts
          // Compute backward: new start = ref start - new duration
          // Use calendar arithmetic (same as computeEventEndDate but reversed) to stay consistent
          const refStart = getEventStartDate(refEvent.startDate, refEvent.startTime);
          const dur = event.duration;
          let newStart: Date;
          switch (dur.unit) {
            case 'hours':
              newStart = new Date(refStart.getTime() - dur.value * 3600000);
              break;
            case 'days': {
              newStart = new Date(refStart);
              newStart.setDate(newStart.getDate() - dur.value);
              break;
            }
            case 'months': {
              newStart = new Date(refStart);
              newStart.setMonth(newStart.getMonth() - dur.value);
              break;
            }
            case 'years': {
              newStart = new Date(refStart);
              newStart.setFullYear(newStart.getFullYear() - dur.value);
              break;
            }
          }
          startDate = toDateStr(newStart);
          startTime = needsTime ? toTimeStr(newStart) : undefined;
        }

        const newEvent: TimelineEvent = {
          id,
          title: event.title,
          description: event.description,
          startDate,
          startTime,
          duration: event.duration,
          order: 0,
          characterIds: event.characterIds ?? [],
          placeId: event.placeId,
          chapterId: event.chapterId,
          tags: event.tags ?? [],
          notes: event.notes,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const insertIndex = position === 'before' ? refIndex : refIndex + 1;
        events.splice(insertIndex, 0, newEvent);
        events.forEach((e, i) => { e.order = i; });

        set(() => ({
          timelineEvents: events,
          ...touchSave(),
        }));
        return id;
      },

      splitTimelineEvent: (id, splitPoints, unit) => {
        if (splitPoints.length < 1) return;
        const events = [...(get().timelineEvents ?? [])].sort((a, b) => a.order - b.order);
        const index = events.findIndex((e) => e.id === id);
        if (index === -1) return;

        const original = events[index];
        const timestamp = now();
        const parts = splitPoints.length + 1;

        // Build percentage boundaries: [0, ...splitPoints, 100]
        const boundaries = [0, ...splitPoints.sort((a, b) => a - b), 100];

        // Compute exact original time span in ms
        const originalStartMs = getEventStartDate(original.startDate, original.startTime).getTime();
        const originalEndMs = computeEventEndDate(original.startDate, original.startTime, original.duration).getTime();
        const totalMs = originalEndMs - originalStartMs;

        const newEvents: TimelineEvent[] = [];
        for (let i = 0; i < parts; i++) {
          const partStartMs = originalStartMs + (boundaries[i] / 100) * totalMs;
          const partEndMs = originalStartMs + (boundaries[i + 1] / 100) * totalMs;
          const dMs = partEndMs - partStartMs;

          // Compute duration in the chosen unit
          let durationValue: number;
          if (unit === 'hours') durationValue = Math.max(1, Math.round(dMs / 3600000));
          else if (unit === 'days') durationValue = Math.max(1, Math.round(dMs / 86400000));
          else if (unit === 'months') durationValue = Math.max(1, Math.round(dMs / (30.44 * 86400000)));
          else durationValue = Math.max(1, Math.round(dMs / (365.25 * 86400000)));

          const duration: EventDuration = { value: durationValue, unit };
          const partStart = new Date(partStartMs);
          const partStartDate = `${partStart.getFullYear()}-${String(partStart.getMonth() + 1).padStart(2, '0')}-${String(partStart.getDate()).padStart(2, '0')}`;
          const h = partStart.getHours();
          const m = partStart.getMinutes();
          const partStartTime = (original.startTime || h !== 0 || m !== 0)
            ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            : undefined;

          newEvents.push({
            id: i === 0 ? original.id : generateId(),
            title: `${original.title} (${i + 1}/${parts})`,
            description: original.description,
            startDate: partStartDate,
            startTime: partStartTime,
            duration,
            order: 0,
            characterIds: [...original.characterIds],
            placeId: original.placeId,
            chapterId: original.chapterId,
            sceneId: i === 0 ? original.sceneId : undefined,
            tags: [...original.tags],
            notes: original.notes,
            createdAt: i === 0 ? original.createdAt : timestamp,
            updatedAt: timestamp,
          });
        }

        events.splice(index, 1, ...newEvents);
        events.forEach((e, i) => { e.order = i; });

        set(() => ({
          timelineEvents: events,
          ...touchSave(),
        }));
      },

      linkEventToScene: (eventId, chapterId, sceneId) =>
        set((s) => ({
          timelineEvents: (s.timelineEvents ?? []).map((e) =>
            e.id === eventId ? { ...e, chapterId, sceneId, updatedAt: now() } : e
          ),
          ...touchSave(),
        })),

      unlinkEventFromScene: (eventId) =>
        set((s) => ({
          timelineEvents: (s.timelineEvents ?? []).map((e) =>
            e.id === eventId ? { ...e, sceneId: undefined, updatedAt: now() } : e
          ),
          ...touchSave(),
        })),

      convertEventToChapter: (eventId) => {
        const state = get();
        const event = (state.timelineEvents ?? []).find((e) => e.id === eventId);
        if (!event) return '';

        const timestamp = now();
        const normalChapters = state.chapters.filter((c) => (c.type ?? 'chapter') === 'chapter');
        const maxNum = normalChapters.length > 0 ? Math.max(...normalChapters.map((c) => c.number)) : 0;
        const chapterId = generateId();

        const newChapter: Chapter = {
          id: chapterId,
          title: event.title,
          number: maxNum + 1,
          type: 'chapter',
          synopsis: event.description ?? '',
          sceneIds: [],
          color: CHAPTER_COLORS[normalChapters.length % CHAPTER_COLORS.length],
          tags: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((s) => ({
          chapters: [...s.chapters, newChapter],
          timelineEvents: (s.timelineEvents ?? []).map((e) =>
            e.id === eventId
              ? { ...e, chapterId, updatedAt: timestamp }
              : e
          ),
          ...touchSave(),
        }));

        return chapterId;
      },

      createSceneForEvent: (eventId, chapterId) => {
        const state = get();
        const event = (state.timelineEvents ?? []).find((e) => e.id === eventId);
        if (!event) return '';

        const timestamp = now();
        const chapter = state.chapters.find((c) => c.id === chapterId);
        if (!chapter) return '';

        const sceneId = generateId();
        const newScene: Scene = {
          id: sceneId,
          title: event.title,
          description: event.description ?? '',
          chapterId,
          orderInChapter: chapter.sceneIds.length,
          characterIds: [...event.characterIds],
          placeId: event.placeId,
          targetWordCount: state.goals.defaultWordsPerScene,
          currentWordCount: 0,
          status: 'outline',
          tags: [...event.tags],
          notes: event.notes,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((s) => ({
          scenes: [...s.scenes, newScene],
          chapters: s.chapters.map((c) =>
            c.id === chapterId ? { ...c, sceneIds: [...c.sceneIds, sceneId], updatedAt: timestamp } : c
          ),
          timelineEvents: (s.timelineEvents ?? []).map((e) =>
            e.id === eventId
              ? { ...e, sceneId, updatedAt: timestamp }
              : e
          ),
          ...touchSave(),
        }));

        return sceneId;
      },

      // ─── Graph node positions ───
      saveGraphNodePositions: (positions) =>
        set((s) => ({
          graphNodePositions: { ...(s.graphNodePositions ?? {}), ...positions },
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
