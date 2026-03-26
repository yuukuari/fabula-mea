import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BookProject, Character, Place, Chapter, Scene, Tag,
  WritingSession, WorldNote, ExcludedPeriod, ProjectGoals,
  Relationship, KeyEvent,
} from '@/types';
import { generateId, now, CHAPTER_COLORS } from '@/lib/utils';

interface BookStore extends BookProject {
  lastSavedAt: string | null;

  // Project
  updateProject: (data: Partial<Pick<BookProject, 'title' | 'author' | 'genre' | 'synopsis'>>) => void;

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

  // Import/Export
  exportProject: () => string;
  importProject: (json: string) => void;
}

const initialState: Omit<BookProject, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Mon Livre',
  author: '',
  genre: '',
  synopsis: '',
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
};

export const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
      lastSavedAt: null,

      updateProject: (data) =>
        set((s) => ({ ...data, updatedAt: now(), lastSavedAt: now() })),

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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteCharacter: (id) =>
        set((s) => ({
          characters: s.characters.filter((c) => c.id !== id),
          scenes: s.scenes.map((sc) => ({
            ...sc,
            characterIds: sc.characterIds.filter((cid) => cid !== id),
          })),
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      addRelationship: (characterId, rel) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, relationships: [...c.relationships, { ...rel, id: generateId() }], updatedAt: now() }
              : c
          ),
          updatedAt: now(),
          lastSavedAt: now(),
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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteRelationship: (characterId, relId) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, relationships: c.relationships.filter((r) => r.id !== relId), updatedAt: now() }
              : c
          ),
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      addKeyEvent: (characterId, event) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, keyEvents: [...c.keyEvents, { ...event, id: generateId() }], updatedAt: now() }
              : c
          ),
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteKeyEvent: (characterId, eventId) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === characterId
              ? { ...c, keyEvents: c.keyEvents.filter((e) => e.id !== eventId), updatedAt: now() }
              : c
          ),
          updatedAt: now(),
          lastSavedAt: now(),
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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deletePlace: (id) =>
        set((s) => ({
          places: s.places.filter((p) => p.id !== id),
          scenes: s.scenes.map((sc) =>
            sc.placeId === id ? { ...sc, placeId: undefined } : sc
          ),
          updatedAt: now(),
          lastSavedAt: now(),
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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteChapter: (id) =>
        set((s) => ({
          chapters: s.chapters.filter((c) => c.id !== id),
          scenes: s.scenes.filter((sc) => sc.chapterId !== id),
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      reorderChapters: (chapterIds) =>
        set((s) => ({
          chapters: chapterIds.map((id, i) => {
            const ch = s.chapters.find((c) => c.id === id)!;
            return { ...ch, number: i + 1 };
          }),
          updatedAt: now(),
          lastSavedAt: now(),
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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteScene: (id) =>
        set((s) => ({
          scenes: s.scenes.filter((sc) => sc.id !== id),
          chapters: s.chapters.map((c) => ({
            ...c,
            sceneIds: c.sceneIds.filter((sid) => sid !== id),
          })),
          writingSessions: s.writingSessions.filter((ws) => ws.sceneId !== id),
          updatedAt: now(),
          lastSavedAt: now(),
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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      // ─── Tags ───
      addTag: (tag) => {
        const id = generateId();
        set((s) => ({
          tags: [...s.tags, { ...tag, id }],
          updatedAt: now(),
          lastSavedAt: now(),
        }));
        return id;
      },

      updateTag: (id, data) =>
        set((s) => ({
          tags: s.tags.map((t) => (t.id === id ? { ...t, ...data } : t)),
          updatedAt: now(),
          lastSavedAt: now(),
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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      // ─── Goals ───
      updateGoals: (data) =>
        set((s) => ({
          goals: { ...s.goals, ...data },
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      addExcludedPeriod: (period) =>
        set((s) => ({
          goals: {
            ...s.goals,
            excludedPeriods: [...s.goals.excludedPeriods, { ...period, id: generateId() }],
          },
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteExcludedPeriod: (id) =>
        set((s) => ({
          goals: {
            ...s.goals,
            excludedPeriods: s.goals.excludedPeriods.filter((p) => p.id !== id),
          },
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      // ─── Writing Sessions ───
      addWritingSession: (session) =>
        set((s) => ({
          writingSessions: [...s.writingSessions, { ...session, id: generateId() }],
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteWritingSession: (id) =>
        set((s) => ({
          writingSessions: s.writingSessions.filter((ws) => ws.id !== id),
          updatedAt: now(),
          lastSavedAt: now(),
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
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      deleteWorldNote: (id) =>
        set((s) => ({
          worldNotes: s.worldNotes.filter((n) => n.id !== id),
          updatedAt: now(),
          lastSavedAt: now(),
        })),

      // ─── Import/Export ───
      exportProject: () => {
        const state = get();
        const project: BookProject = {
          id: state.id,
          title: state.title,
          author: state.author,
          genre: state.genre,
          synopsis: state.synopsis,
          characters: state.characters,
          places: state.places,
          chapters: state.chapters,
          scenes: state.scenes,
          tags: state.tags,
          goals: state.goals,
          writingSessions: state.writingSessions,
          worldNotes: state.worldNotes,
          createdAt: state.createdAt,
          updatedAt: state.updatedAt,
        };
        return JSON.stringify(project, null, 2);
      },

      importProject: (json) => {
        const project = JSON.parse(json) as BookProject;
        set({
          ...project,
          lastSavedAt: now(),
        });
      },
    }),
    {
      name: 'ecrire-mon-livre-storage',
      version: 1,
    }
  )
);
