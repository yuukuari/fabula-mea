import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BookMeta, SagaMeta, WritingMode, CountUnit, BookLayout } from '@/types';
import { generateId, now } from '@/lib/utils';
import { api } from '@/lib/api';

// Sync to cloud (or dev-db in dev mode) when logged in
const shouldSync = () => !!localStorage.getItem('emlb-token');

interface LibraryStore {
  books: BookMeta[];
  sagas: SagaMeta[];
  currentBookId: string | null;

  createBook: (title: string, author?: string, genre?: string, writingMode?: WritingMode, countUnit?: CountUnit, sagaId?: string) => string;
  deleteBook: (id: string) => void;
  selectBook: (id: string | null) => void;
  updateBookMeta: (id: string, data: Partial<BookMeta>) => void;
  loadFromCloud: () => Promise<void>;

  // Saga management
  createSaga: (title: string, opts?: { description?: string; author?: string; genre?: string; writingMode?: WritingMode; countUnit?: CountUnit; layout?: BookLayout }) => string;
  deleteSaga: (id: string) => void;
  updateSagaMeta: (id: string, data: Partial<SagaMeta>) => void;
  addBookToSaga: (sagaId: string, bookId: string) => void;
}

const BOOK_STORAGE_PREFIX = 'fabula-mea-book-';

export function getBookStorageKey(bookId: string): string {
  return `${BOOK_STORAGE_PREFIX}${bookId}`;
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      books: [],
      sagas: [],
      currentBookId: null,

      createBook: (title, author = '', genre = '', writingMode = 'count', countUnit = 'words', sagaId) => {
        const id = generateId();
        const timestamp = now();
        const meta: BookMeta = {
          id, title, author, genre, writingMode, countUnit,
          sagaId,
          orderInSaga: sagaId ? get().sagas.find((s) => s.id === sagaId)?.bookIds.length ?? 0 : undefined,
          chaptersCount: 0, scenesCount: 0, charactersCount: 0,
          createdAt: timestamp, updatedAt: timestamp,
        };
        set((s) => ({ books: [...s.books, meta] }));

        // Add book to saga's bookIds
        if (sagaId) {
          set((s) => ({
            sagas: s.sagas.map((sg) =>
              sg.id === sagaId
                ? { ...sg, bookIds: [...sg.bookIds, id], updatedAt: now() }
                : sg
            ),
          }));
          if (shouldSync()) {
            api.sagas.saveMeta(get().sagas).catch(console.error);
          }
        }

        if (shouldSync()) {
          const books = [...get().books];
          api.library.save(books).catch(console.error);
        }
        return id;
      },

      deleteBook: (id) => {
        const book = get().books.find((b) => b.id === id);
        localStorage.removeItem(getBookStorageKey(id));
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          currentBookId: s.currentBookId === id ? null : s.currentBookId,
        }));

        // Remove book from saga's bookIds
        if (book?.sagaId) {
          set((s) => ({
            sagas: s.sagas.map((sg) =>
              sg.id === book.sagaId
                ? { ...sg, bookIds: sg.bookIds.filter((bid) => bid !== id), updatedAt: now() }
                : sg
            ),
          }));
          if (shouldSync()) {
            api.sagas.saveMeta(get().sagas).catch(console.error);
          }
        }

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
          const [cloudBooks, cloudSagas] = await Promise.all([
            api.library.get() as Promise<BookMeta[]>,
            api.sagas.getMeta() as Promise<SagaMeta[]>,
          ]);

          if (cloudBooks.length > 0) {
            set((s) => {
              const localIds = new Set(s.books.map((b) => b.id));
              const added = cloudBooks.filter((b) => !localIds.has(b.id));
              const updated = s.books.map((b) => {
                const cloud = cloudBooks.find((cb) => cb.id === b.id);
                return cloud && cloud.updatedAt > b.updatedAt ? cloud : b;
              });
              return { books: [...updated, ...added] };
            });
          }

          if (cloudSagas.length > 0) {
            set((s) => {
              const localIds = new Set(s.sagas.map((sg) => sg.id));
              const added = cloudSagas.filter((sg) => !localIds.has(sg.id));
              const updated = s.sagas.map((sg) => {
                const cloud = cloudSagas.find((csg) => csg.id === sg.id);
                return cloud && cloud.updatedAt > sg.updatedAt ? cloud : sg;
              });
              return { sagas: [...updated, ...added] };
            });
          }
        } catch (err) {
          console.warn('[loadFromCloud] library:', err);
        }
      },

      // ─── Saga management ───

      createSaga: (title, opts = {}) => {
        const id = generateId();
        const timestamp = now();
        // Strip cover images from layout to avoid bloating localStorage
        const { coverFront: _cf, coverBack: _cb, ...layoutWithoutCovers } = opts.layout ?? {} as BookLayout;
        const meta: SagaMeta = {
          id, title,
          description: opts.description ?? '',
          author: opts.author ?? '',
          genre: opts.genre ?? '',
          writingMode: opts.writingMode ?? 'count',
          countUnit: opts.countUnit ?? 'words',
          layout: opts.layout ? layoutWithoutCovers as BookLayout : undefined,
          bookIds: [],
          createdAt: timestamp, updatedAt: timestamp,
        };
        set((s) => ({ sagas: [...s.sagas, meta] }));
        if (shouldSync()) {
          api.sagas.saveMeta(get().sagas).catch(console.error);
        }
        return id;
      },

      deleteSaga: (id) => {
        // Remove saga reference from all books in this saga
        set((s) => ({
          sagas: s.sagas.filter((sg) => sg.id !== id),
          books: s.books.map((b) =>
            b.sagaId === id ? { ...b, sagaId: undefined, orderInSaga: undefined } : b
          ),
        }));
        localStorage.removeItem(`fabula-mea-saga-${id}`);
        if (shouldSync()) {
          api.sagas.delete(id).catch(console.error);
          api.sagas.saveMeta(get().sagas).catch(console.error);
          api.library.save(get().books).catch(console.error);
        }
      },

      updateSagaMeta: (id, data) => {
        // Strip cover images from layout to avoid bloating localStorage
        const cleaned = { ...data };
        if (cleaned.layout) {
          const { coverFront: _cf, coverBack: _cb, ...rest } = cleaned.layout;
          cleaned.layout = rest as BookLayout;
        }
        set((s) => ({
          sagas: s.sagas.map((sg) =>
            sg.id === id ? { ...sg, ...cleaned, updatedAt: now() } : sg
          ),
        }));
        if (shouldSync()) {
          api.sagas.saveMeta(get().sagas).catch(console.error);
        }
      },

      addBookToSaga: (sagaId, bookId) => {
        set((s) => ({
          sagas: s.sagas.map((sg) =>
            sg.id === sagaId
              ? { ...sg, bookIds: [...sg.bookIds, bookId], updatedAt: now() }
              : sg
          ),
          books: s.books.map((b) =>
            b.id === bookId
              ? { ...b, sagaId, orderInSaga: get().sagas.find((sg) => sg.id === sagaId)?.bookIds.length ?? 0 }
              : b
          ),
        }));
        if (shouldSync()) {
          api.sagas.saveMeta(get().sagas).catch(console.error);
          api.library.save(get().books).catch(console.error);
        }
      },
    }),
    {
      name: 'fabula-mea-library',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          state.sagas = [];
        }
        if (version < 3) {
          // Add writingMode/countUnit to existing sagas
          const sagas = (state.sagas ?? []) as Record<string, unknown>[];
          state.sagas = sagas.map((s) => ({
            ...s,
            writingMode: s.writingMode ?? 'count',
            countUnit: s.countUnit ?? 'words',
            author: s.author ?? '',
            genre: s.genre ?? '',
          }));
        }
        return state as unknown as LibraryStore;
      },
    }
  )
);
