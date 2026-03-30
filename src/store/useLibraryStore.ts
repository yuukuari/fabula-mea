import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BookMeta, WritingMode } from '@/types';
import { generateId, now } from '@/lib/utils';
import { api } from '@/lib/api';

// Sync to cloud (or dev-db in dev mode) when logged in
const shouldSync = () => !!localStorage.getItem('emlb-token');

interface LibraryStore {
  books: BookMeta[];
  currentBookId: string | null;

  createBook: (title: string, author?: string, genre?: string, writingMode?: WritingMode) => string;
  deleteBook: (id: string) => void;
  selectBook: (id: string | null) => void;
  updateBookMeta: (id: string, data: Partial<BookMeta>) => void;
  loadFromCloud: () => Promise<void>;
}

const BOOK_STORAGE_PREFIX = 'ecrire-mon-livre-book-';

export function getBookStorageKey(bookId: string): string {
  return `${BOOK_STORAGE_PREFIX}${bookId}`;
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      books: [],
      currentBookId: null,

      createBook: (title, author = '', genre = '', writingMode = 'count') => {
        const id = generateId();
        const timestamp = now();
        const meta: BookMeta = {
          id, title, author, genre, writingMode,
          chaptersCount: 0, scenesCount: 0, charactersCount: 0,
          createdAt: timestamp, updatedAt: timestamp,
        };
        set((s) => ({ books: [...s.books, meta] }));
        if (shouldSync()) {
          const books = [...get().books];
          api.library.save(books).catch(console.error);
        }
        return id;
      },

      deleteBook: (id) => {
        localStorage.removeItem(getBookStorageKey(id));
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          currentBookId: s.currentBookId === id ? null : s.currentBookId,
        }));
        if (shouldSync()) {
          api.books.delete(id).catch(console.error);
          const books = get().books.filter((b) => b.id !== id);
          api.library.save(books).catch(console.error);
        }
      },

      selectBook: (id) => set({ currentBookId: id }),

      updateBookMeta: (id, data) => {
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id ? { ...b, ...data, updatedAt: now() } : b
          ),
        }));
        if (shouldSync()) {
          const books = get().books;
          api.library.save(books).catch(console.error);
        }
      },

      loadFromCloud: async () => {
        if (!shouldSync()) return;
        try {
          const cloudBooks = await api.library.get() as BookMeta[];
          if (cloudBooks.length === 0) return;

          set((s) => {
            const localIds = new Set(s.books.map((b) => b.id));
            const added = cloudBooks.filter((b) => !localIds.has(b.id));
            const updated = s.books.map((b) => {
              const cloud = cloudBooks.find((cb) => cb.id === b.id);
              return cloud && cloud.updatedAt > b.updatedAt ? cloud : b;
            });
            return { books: [...updated, ...added] };
          });
        } catch (err) {
          console.warn('[loadFromCloud] library:', err);
        }
      },
    }),
    {
      name: 'ecrire-mon-livre-library',
      version: 1,
    }
  )
);
