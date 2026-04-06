import { getBookStorageKey } from '@/store/useLibraryStore';
import type { BookMeta, BookProject, TimelineEvent } from '@/types';
import { generateId, now, convertToSimpleDuration } from '@/lib/utils';

const OLD_STORAGE_KEY = 'ecrire-mon-livre-storage';
const LIBRARY_KEY = 'fabula-mea-library';
const MIGRATION_DONE_KEY = 'ecrire-mon-livre-migrated-v2';
const RENAME_MIGRATION_KEY = 'fabula-mea-migrated-keys-v1';

/**
 * One-time migration: if the old single-book storage exists and
 * we haven't migrated yet, convert it to the multi-book format.
 */
export function migrateFromSingleBook() {
  // Already migrated
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;

  const raw = localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    return;
  }

  try {
    // The old store used Zustand persist wrapper: { state: {...}, version: 1 }
    const parsed = JSON.parse(raw);
    const oldState = parsed?.state ?? parsed;

    // Only migrate if there's actual content
    const hasContent =
      oldState.characters?.length > 0 ||
      oldState.places?.length > 0 ||
      oldState.chapters?.length > 0 ||
      oldState.scenes?.length > 0;

    if (!hasContent) {
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      return;
    }

    const bookId = oldState.id || crypto.randomUUID();
    const project: BookProject = {
      id: bookId,
      title: oldState.title || 'Mon Livre',
      author: oldState.author || '',
      genre: oldState.genre || '',
      synopsis: oldState.synopsis || '',
      writingMode: 'count',
      characters: oldState.characters || [],
      places: oldState.places || [],
      chapters: oldState.chapters || [],
      scenes: oldState.scenes || [],
      tags: oldState.tags || [],
      goals: oldState.goals || { mode: 'none' as const, objectiveEnabled: false, excludedPeriods: [] },
      dailySnapshots: oldState.dailySnapshots || [],
      worldNotes: oldState.worldNotes || [],
      maps: oldState.maps || [],
      createdAt: oldState.createdAt || new Date().toISOString(),
      updatedAt: oldState.updatedAt || new Date().toISOString(),
    };

    // Save book data
    localStorage.setItem(getBookStorageKey(bookId), JSON.stringify(project));

    // Create library entry
    const meta: BookMeta = {
      id: bookId,
      title: project.title,
      author: project.author,
      genre: project.genre,
      writingMode: 'count',
      chaptersCount: project.chapters.length,
      scenesCount: project.scenes.length,
      charactersCount: project.characters.length,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    // Save library with Zustand persist format
    const libraryState = {
      state: { books: [meta], currentBookId: null },
      version: 1,
    };
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(libraryState));

    // Clean up old storage
    localStorage.removeItem(OLD_STORAGE_KEY);
    localStorage.setItem(MIGRATION_DONE_KEY, '1');

    console.log(`Migrated book "${project.title}" to multi-book format`);
  } catch (e) {
    console.error('Migration failed:', e);
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
  }
}

/**
 * One-time migration: rename localStorage keys from "ecrire-mon-livre-*"
 * to "fabula-mea-*" following the app rename.
 */
export function migrateStorageKeys() {
  if (localStorage.getItem(RENAME_MIGRATION_KEY)) return;

  // Migrate library key
  const oldLibrary = localStorage.getItem('ecrire-mon-livre-library');
  if (oldLibrary && !localStorage.getItem('fabula-mea-library')) {
    localStorage.setItem('fabula-mea-library', oldLibrary);
    localStorage.removeItem('ecrire-mon-livre-library');
  }

  // Migrate book keys
  const keysToRename: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('ecrire-mon-livre-book-')) keysToRename.push(key);
  }
  keysToRename.forEach((oldKey) => {
    const newKey = oldKey.replace('ecrire-mon-livre-book-', 'fabula-mea-book-');
    const data = localStorage.getItem(oldKey);
    if (data) {
      localStorage.setItem(newKey, data);
      localStorage.removeItem(oldKey);
    }
  });

  localStorage.setItem(RENAME_MIGRATION_KEY, '1');
}

/**
 * Migrate scenes with startDateTime/endDateTime to independent TimelineEvents.
 * Called at book load time. Idempotent: skips if timelineEvents already exists.
 * Clears startDateTime/endDateTime from scenes after migration.
 */
export function migrateScenesToTimelineEvents(project: BookProject): BookProject {
  // Already migrated or new book
  if (project.timelineEvents !== undefined) return project;

  const datedScenes = project.scenes.filter((s) => s.startDateTime);
  if (datedScenes.length === 0) {
    return { ...project, timelineEvents: [] };
  }

  // Sort by startDateTime for chronological order
  const sorted = [...datedScenes].sort(
    (a, b) => new Date(a.startDateTime!).getTime() - new Date(b.startDateTime!).getTime()
  );

  const timestamp = now();
  const events: TimelineEvent[] = sorted.map((scene, index) => {
    const { startDate, startTime, duration } = convertToSimpleDuration(
      scene.startDateTime!,
      scene.endDateTime
    );

    return {
      id: generateId(),
      title: scene.title || `Événement ${index + 1}`,
      description: scene.description || undefined,
      startDate,
      startTime,
      duration,
      order: index,
      characterIds: [...scene.characterIds],
      placeId: scene.placeId,
      chapterId: scene.chapterId,
      sceneId: scene.id,
      tags: [...scene.tags],
      notes: scene.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  // Migrate scenes: clear old fields, populate new date+duration fields for linked scenes
  const eventBySceneId = new Map(events.map((e) => [e.sceneId!, e]));
  const migratedScenes = project.scenes.map((s) => {
    const evt = eventBySceneId.get(s.id);
    return {
      ...s,
      startDateTime: undefined,
      endDateTime: undefined,
      startDate: evt?.startDate,
      startTime: evt?.startTime,
      duration: evt?.duration,
    };
  });

  return {
    ...project,
    timelineEvents: events,
    scenes: migratedScenes,
  };
}
