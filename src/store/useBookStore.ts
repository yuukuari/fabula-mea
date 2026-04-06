import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  BookProject, Character, Place, Chapter, Scene, Tag,
  WorldNote, ExcludedPeriod, ProjectGoals, DailySnapshot,
  Relationship, KeyEvent, MapItem, MapPin, SelfComment, NoteIdea,
  BookLayout, TimelineEvent, EventDuration, DurationUnit,
} from '@/types';
import { generateId, now, CHAPTER_COLORS, FRONT_MATTER_LABEL, BACK_MATTER_LABEL, FRONT_MATTER_NUMBER, BACK_MATTER_NUMBER, SPECIAL_CHAPTER_COLOR, computeEventEndDate, getEventStartDate, countFromHtml, convertCount } from '@/lib/utils';
import { getBookStorageKey, useLibraryStore } from './useLibraryStore';
import { api } from '@/lib/api';
import { useSyncStore } from './useSyncStore';
import { useSagaStore } from './useSagaStore';
import { isBase64, uploadImage } from '@/lib/upload';
import { getOverallProgress, getDailyGoal, getCompletedScenesCount, getTodayProgress as calcTodayProgress } from '@/lib/calculations';
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

/**
 * Migrate base64 images to CDN URLs in a BookProject.
 * Mutates the project data in-place and returns true if any migration occurred.
 */
async function migrateBase64Images(data: BookProject): Promise<boolean> {
  if (IS_DEV) return false;

  let migrated = await migrateEncyclopediaImages(data);

  // Layout covers (book-specific, not in encyclopedia helper)
  const coverPromises: Promise<void>[] = [];
  if (data.layout?.coverFront && isBase64(data.layout.coverFront)) {
    coverPromises.push(uploadImage(data.layout.coverFront, 'cover-front').then((url) => { data.layout!.coverFront = url; migrated = true; }));
  }
  if (data.layout?.coverBack && isBase64(data.layout.coverBack)) {
    coverPromises.push(uploadImage(data.layout.coverBack, 'cover-back').then((url) => { data.layout!.coverBack = url; migrated = true; }));
  }
  await Promise.all(coverPromises);
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
  recordWritingMinutes: (minutes: number) => void;

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
      mode: 'none',
      objectiveEnabled: false,
      excludedPeriods: [],
    },
    dailySnapshots: [],
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
    dailySnapshots: state.dailySnapshots,
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

/** Migrate old goals format to new format */
function migrateGoals(project: BookProject): BookProject {
  const g = project.goals as unknown as Record<string, unknown>;
  if (!g.mode) {
    project.goals = {
      mode: 'none',
      objectiveEnabled: false,
      excludedPeriods: Array.isArray(g.excludedPeriods) ? g.excludedPeriods as ExcludedPeriod[] : [],
    };
  }
  // Migrate dailyGoalEnabled → objectiveEnabled
  if ('dailyGoalEnabled' in g && !('objectiveEnabled' in g)) {
    const goals = project.goals as unknown as Record<string, unknown>;
    goals.objectiveEnabled = !!g.dailyGoalEnabled;
    if (g.dailyGoalEnabled) {
      goals.objectiveType = 'wordCount';
    }
    delete goals.dailyGoalEnabled;
    project.goals = goals as unknown as typeof project.goals;
  }
  if (!project.dailySnapshots) {
    project.dailySnapshots = [];
  }
  return project;
}

/** Update or create today's daily snapshot */
function updateDailySnapshot(state: BookProject): DailySnapshot[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const scenes = state.scenes;
  const goals = state.goals;
  // currentWordCount is already stored in the active countUnit
  const totalWritten = scenes.reduce((sum, s) => sum + s.currentWordCount, 0);

  // Calculate today's written count using localStorage snapshot
  const { todayCount } = calcTodayProgress(state.id, totalWritten);

  const snapshot: DailySnapshot = {
    date: todayStr,
    totalWritten,
    writtenToday: todayCount,
    dailyGoal: getDailyGoal(scenes, goals),
    objectiveType: goals.objectiveEnabled ? goals.objectiveType : undefined,
    timeGoal: goals.objectiveType === 'time' ? goals.timeObjective : undefined,
    targetTotal: goals.mode === 'total' ? (goals.targetTotalCount ?? null) : (goals.mode === 'perScene' && goals.targetCountPerScene ? goals.targetCountPerScene * scenes.length : null),
    targetEndDate: goals.targetEndDate ?? null,
    progress: getOverallProgress(scenes, goals),
    completedScenes: getCompletedScenesCount(scenes),
    totalScenes: scenes.length,
  };

  const existing = state.dailySnapshots || [];
  const todayIdx = existing.findIndex((s) => s.date === todayStr);
  if (todayIdx >= 0) {
    // Preserve writing minutes tracked by the timer
    if (existing[todayIdx].writingMinutesToday) {
      snapshot.writingMinutesToday = existing[todayIdx].writingMinutesToday;
    }
    // Skip update if nothing changed (avoid unnecessary re-renders)
    const prev = existing[todayIdx];
    if (
      prev.totalWritten === snapshot.totalWritten &&
      prev.writtenToday === snapshot.writtenToday &&
      prev.dailyGoal === snapshot.dailyGoal &&
      prev.progress === snapshot.progress &&
      prev.completedScenes === snapshot.completedScenes &&
      prev.totalScenes === snapshot.totalScenes &&
      prev.writingMinutesToday === snapshot.writingMinutesToday
    ) {
      return existing;
    }
    const snapshots = [...existing];
    snapshots[todayIdx] = snapshot;
    return snapshots;
  }
  return [...existing, snapshot];
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
        // Cancel any pending debounced save from previous book
        cancelPendingSave();

        // Save current book first if loaded
        const current = get();
        if (current._loaded && current.id && current.id !== bookId) {
          localStorage.setItem(
            getBookStorageKey(current.id),
            JSON.stringify(extractProjectData(current))
          );
        }

        // 1. Load from localStorage immediately (cache for fast display)
        const raw = localStorage.getItem(getBookStorageKey(bookId));
        if (raw) {
          const project = migrateGoals(ensureSpecialChapters(JSON.parse(raw) as BookProject));
          set({ ...emptyState(), ...project, lastSavedAt: now(), _loaded: true });
          if (project.sagaId) {
            useSagaStore.getState().loadSaga(project.sagaId);
          } else {
            useSagaStore.getState().unloadSaga();
          }
        } else {
          // No local cache — set minimal state so the book id is tracked
          set({ ...emptyState(), id: bookId, _loaded: true });
          useSagaStore.getState().unloadSaga();
        }

        // 2. Fetch from server (source of truth) and apply — but only if user hasn't edited since
        if (shouldSync()) {
          const loadedAt = get().updatedAt;
          useSyncStore.getState().setSyncing();
          api.books.get(bookId).then((remoteData) => {
            const cur = get();
            // Only apply cloud data if we're still on the same book
            if (cur.id !== bookId) return;
            if (cur.updatedAt !== loadedAt) {
              // User already edited — don't overwrite, just mark as synced
              useSyncStore.getState().setSynced();
              return;
            }
            const remote = migrateGoals(ensureSpecialChapters(remoteData as BookProject));
            set({ ...emptyState(), ...remote, lastSavedAt: now(), _loaded: true });
            localStorage.setItem(getBookStorageKey(bookId), JSON.stringify(remote));
            if (remote.sagaId) {
              useSagaStore.getState().loadSaga(remote.sagaId);
            }
            useSyncStore.getState().setSynced();
          }).catch(() => {
            // Remote not found yet (new book) or offline — use local cache
            if (raw) useSyncStore.getState().setSynced();
            else useSyncStore.getState().setError('Livre introuvable sur le serveur');
          });
        }
      },

      saveBook: () => {
        const state = get();
        if (!state._loaded || !state.id) return;
        // Update daily snapshot before saving
        const snapshots = updateDailySnapshot(state);
        if (snapshots !== state.dailySnapshots) {
          set({ dailySnapshots: snapshots });
        }
        const data = extractProjectData({ ...state, dailySnapshots: snapshots });
        const json = JSON.stringify(data);

        // Sauvegarde locale (immédiate, cache)
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

        // Sauvegarde cloud (obligatoire avec retry)
        if (shouldSync()) {
          const bookIdAtSave = state.id;
          useSyncStore.getState().setSyncing();

          migrateBase64Images(data).then((didMigrate) => {
            if (didMigrate) {
              const cur = get();
              if (cur.id === bookIdAtSave && cur._loaded) {
                set({
                  characters: data.characters,
                  places: data.places,
                  worldNotes: data.worldNotes,
                  maps: data.maps,
                  layout: data.layout,
                });
                const fresh = extractProjectData(get());
                localStorage.setItem(getBookStorageKey(bookIdAtSave), JSON.stringify(fresh));
                return cloudSaveWithRetry(() => api.books.save(bookIdAtSave, fresh));
              }
            }
            return cloudSaveWithRetry(() => api.books.save(bookIdAtSave, data));
          })
            .then(() => {
              // Only update sync status if still on the same book
              if (get().id === bookIdAtSave) useSyncStore.getState().setSynced();
            })
            .catch((err) => {
              if (IS_DEV) console.error('Cloud save failed after retries:', err);
              if (get().id === bookIdAtSave) useSyncStore.getState().setError('Échec de la sauvegarde en ligne');
            });
        }
      },

      unloadBook: () => {
        cancelPendingSave();
        const state = get();

        // Save before unloading
        if (state._loaded && state.id) {
          const projectData = extractProjectData(state);
          const json = JSON.stringify(projectData);
          localStorage.setItem(getBookStorageKey(state.id), json);
          if (shouldSync()) {
            cloudSaveWithRetry(() => api.books.save(state.id, projectData))
              .catch(() => useSyncStore.getState().setError('Échec de la sauvegarde en ligne'));
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
        set((s) => {
          const prev = s.countUnit ?? 'words';
          if (prev === unit) return {};

          // Recount scenes: use HTML content when available (write mode), otherwise convert with ratio
          const scenes = s.scenes.map((sc) => {
            const newCount = sc.content
              ? countFromHtml(sc.content, unit)
              : convertCount(sc.currentWordCount, prev, unit);
            const newTarget = sc.targetWordCount
              ? convertCount(sc.targetWordCount, prev, unit)
              : sc.targetWordCount;
            return { ...sc, currentWordCount: newCount, targetWordCount: newTarget };
          });

          // Convert goal values
          const goals = { ...s.goals };
          if (goals.targetTotalCount) goals.targetTotalCount = convertCount(goals.targetTotalCount, prev, unit);
          if (goals.targetCountPerScene) goals.targetCountPerScene = convertCount(goals.targetCountPerScene, prev, unit);
          if (goals.manualDailyGoal) goals.manualDailyGoal = convertCount(goals.manualDailyGoal, prev, unit);

          return { countUnit: unit, scenes, goals, ...touchSave() };
        }),

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
        const { characters, id } = enc.createCharacter(get().characters, char);
        set(() => ({ characters, ...touchSave() }));
        return id;
      },
      updateCharacter: (id, data) =>
        set((s) => ({ characters: enc.updateCharacter(s.characters, id, data), ...touchSave() })),
      deleteCharacter: (id) =>
        set((s) => ({
          characters: enc.deleteCharacter(s.characters, id),
          // Book-specific: clean scene references
          scenes: s.scenes.map((sc) => ({ ...sc, characterIds: sc.characterIds.filter((cid) => cid !== id) })),
          ...touchSave(),
        })),
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
        set((s) => ({
          places: enc.deletePlace(s.places, id),
          // Book-specific: clean scene references
          scenes: s.scenes.map((sc) => sc.placeId === id ? { ...sc, placeId: undefined } : sc),
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
              targetWordCount: scene.targetWordCount ?? 0,
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
        const { tags, id } = enc.createTag(get().tags, tag);
        set(() => ({ tags, ...touchSave() }));
        return id;
      },
      updateTag: (id, data) =>
        set((s) => ({ tags: enc.updateTag(s.tags, id, data), ...touchSave() })),
      deleteTag: (id) =>
        set((s) => ({
          tags: enc.deleteTag(s.tags, id),
          // Book-specific: cascade tag removal to characters and places
          characters: s.characters.map((c) => ({ ...c, tags: c.tags.filter((tid) => tid !== id) })),
          places: s.places.map((p) => ({ ...p, tags: p.tags.filter((tid) => tid !== id) })),
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

      recordWritingMinutes: (minutes) =>
        set((s) => {
          const todayStr = new Date().toISOString().split('T')[0];
          const snapshots = [...(s.dailySnapshots || [])];
          const idx = snapshots.findIndex((snap) => snap.date === todayStr);
          if (idx >= 0) {
            snapshots[idx] = { ...snapshots[idx], writingMinutesToday: minutes };
          } else {
            // Create a minimal snapshot; full snapshot will be rebuilt on next saveBook
            const totalWritten = s.scenes.reduce((sum, sc) => sum + sc.currentWordCount, 0);
            snapshots.push({
              date: todayStr,
              totalWritten,
              writtenToday: 0,
              dailyGoal: null,
              targetTotal: null,
              targetEndDate: null,
              progress: 0,
              completedScenes: 0,
              totalScenes: s.scenes.length,
              writingMinutesToday: minutes,
            });
          }
          return { dailySnapshots: snapshots, ...touchSave() };
        }),

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
        const { maps, id } = enc.createMap(get().maps ?? [], map);
        set(() => ({ maps, ...touchSave() }));
        return id;
      },
      updateMap: (id, data) =>
        set((s) => ({ maps: enc.updateMap(s.maps ?? [], id, data), ...touchSave() })),
      deleteMap: (id) =>
        set((s) => ({ maps: enc.deleteMap(s.maps ?? [], id), ...touchSave() })),
      addMapPin: (mapId, pin) => {
        const { maps, id } = enc.addMapPin(get().maps ?? [], mapId, pin);
        set(() => ({ maps, ...touchSave() }));
        return id;
      },
      updateMapPin: (mapId, pinId, data) =>
        set((s) => ({ maps: enc.updateMapPin(s.maps ?? [], mapId, pinId, data), ...touchSave() })),
      deleteMapPin: (mapId, pinId) =>
        set((s) => ({ maps: enc.deleteMapPin(s.maps ?? [], mapId, pinId), ...touchSave() })),

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
          `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
          const partStartDate = `${String(partStart.getFullYear()).padStart(4, '0')}-${String(partStart.getMonth() + 1).padStart(2, '0')}-${String(partStart.getDate()).padStart(2, '0')}`;
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
          targetWordCount: 0,
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

    })
  )
);

// Auto-save: whenever state changes (debounced), save to localStorage
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/** Cancel any pending debounced save — called on book load/unload to prevent cross-book saves */
export function cancelPendingSave(): void {
  if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
}

useBookStore.subscribe(
  (state) => state.updatedAt,
  () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      useBookStore.getState().saveBook();
    }, 500);
  }
);

