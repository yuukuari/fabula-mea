import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BookMeta, WritingMode } from '@/types';
import { generateId, now } from '@/lib/utils';

interface LibraryStore {
  books: BookMeta[];
  currentBookId: string | null;

  createBook: (title: string, author?: string, genre?: string, writingMode?: WritingMode) => string;
  deleteBook: (id: string) => void;
  selectBook: (id: string | null) => void;
  updateBookMeta: (id: string, data: Partial<BookMeta>) => void;
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
          id,
          title,
          author,
          genre,
          writingMode,
          chaptersCount: 0,
          scenesCount: 0,
          charactersCount: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => ({ books: [...s.books, meta] }));
        return id;
      },

      deleteBook: (id) => {
        // Remove book data from localStorage
        localStorage.removeItem(getBookStorageKey(id));
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          currentBookId: s.currentBookId === id ? null : s.currentBookId,
        }));
      },

      selectBook: (id) => set({ currentBookId: id }),

      updateBookMeta: (id, data) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id ? { ...b, ...data, updatedAt: now() } : b
          ),
        })),
    }),
    {
      name: 'ecrire-mon-livre-library',
      version: 1,
    }
  )
);
