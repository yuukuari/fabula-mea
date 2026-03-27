import { getBookStorageKey } from '@/store/useLibraryStore';
import type { BookMeta, BookProject } from '@/types';

const OLD_STORAGE_KEY = 'ecrire-mon-livre-storage';
const LIBRARY_KEY = 'ecrire-mon-livre-library';
const MIGRATION_DONE_KEY = 'ecrire-mon-livre-migrated-v2';

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
      characters: oldState.characters || [],
      places: oldState.places || [],
      chapters: oldState.chapters || [],
      scenes: oldState.scenes || [],
      tags: oldState.tags || [],
      goals: oldState.goals || { defaultWordsPerScene: 500, excludedPeriods: [] },
      writingSessions: oldState.writingSessions || [],
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
