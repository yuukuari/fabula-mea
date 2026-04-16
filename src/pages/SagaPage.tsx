import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GripVertical, Trash2, Library, X, AlertTriangle, Hash, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useBookStore } from '@/store/useBookStore';
import type { BookMeta, SagaMeta, WritingMode, CountUnit } from '@/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableBookItem({ book, onRemoveDisabled }: { book: BookMeta; onRemoveDisabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: book.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 bg-white/60 rounded-lg border border-parchment-200"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-ink-200 hover:text-ink-400">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink-500 text-sm truncate">{book.title}</p>
        {book.author && <p className="text-xs text-ink-300 truncate">{book.author}</p>}
      </div>
      <span className="text-xs text-ink-200 shrink-0">Tome {(book.orderInSaga ?? 0) + 1}</span>
    </div>
  );
}

function DeleteSagaDialog({
  sagaTitle,
  onConfirm,
  onCancel,
}: {
  sagaTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink-500">Supprimer la saga</h3>
            <p className="text-sm text-ink-300 mt-1">Cette action est irréversible.</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-800 space-y-2">
          <p>
            La saga <strong>« {sagaTitle} »</strong> sera supprimée. L'encyclopédie partagée (personnages, lieux, univers, cartes) sera perdue.
          </p>
          <p>
            Les livres de la saga ne seront pas supprimés mais deviendront des livres indépendants sans encyclopédie.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
            Supprimer
          </button>
          <button onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        </div>
      </div>
    </div>
  );
}

export function SagaPage() {
  const { sagaId } = useParams<{ sagaId: string }>();
  const navigate = useNavigate();
  const sagas = useLibraryStore((s) => s.sagas);
  const books = useLibraryStore((s) => s.books);
  const updateSagaMeta = useLibraryStore((s) => s.updateSagaMeta);
  const updateBookMeta = useLibraryStore((s) => s.updateBookMeta);
  const deleteSaga = useLibraryStore((s) => s.deleteSaga);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const saga = sagas.find((s) => s.id === sagaId);
  const sagaBooks = saga
    ? saga.bookIds
        .map((bid) => books.find((b) => b.id === bid))
        .filter((b): b is BookMeta => !!b)
    : [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (!saga) {
    return (
      <div className="page-container max-w-2xl text-center py-20">
        <p className="text-ink-300">Saga introuvable.</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">Retour à l'accueil</button>
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sagaBooks.findIndex((b) => b.id === active.id);
    const newIndex = sagaBooks.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(sagaBooks, oldIndex, newIndex);
    const newBookIds = reordered.map((b) => b.id);

    updateSagaMeta(saga.id, { bookIds: newBookIds });

    // Update orderInSaga for each book
    const libraryStore = useLibraryStore.getState();
    reordered.forEach((book, i) => {
      libraryStore.updateBookMeta(book.id, { orderInSaga: i });
    });
  };

  const handleDelete = () => {
    deleteSaga(saga.id);
    navigate('/');
  };

  /** Update saga meta AND propagate relevant fields to all books in the saga */
  const handleSagaUpdate = (data: Partial<SagaMeta>) => {
    updateSagaMeta(saga.id, data);

    // Fields that propagate to BookMeta (library store)
    const metaFields: Partial<BookMeta> = {};
    if (data.author !== undefined) metaFields.author = data.author ?? '';
    if (data.genre !== undefined) metaFields.genre = data.genre;
    if (data.writingMode !== undefined) metaFields.writingMode = data.writingMode;
    if (data.countUnit !== undefined) metaFields.countUnit = data.countUnit;

    if (Object.keys(metaFields).length > 0) {
      sagaBooks.forEach((book) => updateBookMeta(book.id, metaFields));
    }

    // Fields that propagate to BookProject (localStorage)
    const projectFields: Record<string, unknown> = {};
    if (data.author !== undefined) projectFields.author = data.author ?? '';
    if (data.genre !== undefined) projectFields.genre = data.genre;
    if (data.writingMode !== undefined) projectFields.writingMode = data.writingMode;
    if (data.countUnit !== undefined) projectFields.countUnit = data.countUnit;

    if (Object.keys(projectFields).length > 0) {
      const BOOK_PREFIX = 'fabula-mea-book-';
      sagaBooks.forEach((book) => {
        const key = `${BOOK_PREFIX}${book.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const bookData = JSON.parse(stored);
            Object.assign(bookData, projectFields);
            localStorage.setItem(key, JSON.stringify(bookData));
          } catch { /* ignore parse errors */ }
        }
      });

      // If the currently loaded book is in this saga, update its store too
      const currentBookState = useBookStore.getState();
      if (saga.bookIds.includes(currentBookState.id)) {
        useBookStore.setState(projectFields);
      }
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-ink-300 hover:text-ink-500 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la bibliothèque
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-bordeaux-50 rounded-lg flex items-center justify-center">
          <Library className="w-5 h-5 text-bordeaux-500" />
        </div>
        <h2 className="section-title !mb-0">Gestion de la saga</h2>
      </div>

      {/* Title & description */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Informations</h3>
        <div className="space-y-4">
          <div>
            <label className="label-field">Titre de la saga</label>
            <input
              value={saga.title}
              onChange={(e) => updateSagaMeta(saga.id, { title: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Synopsis</label>
            <textarea
              value={saga.description ?? ''}
              onChange={(e) => updateSagaMeta(saga.id, { description: e.target.value })}
              className="textarea-field"
              rows={3}
              placeholder="Synopsis de la saga..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Auteur</label>
              <input
                value={saga.author ?? ''}
                onChange={(e) => handleSagaUpdate({ author: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Genre</label>
              <input
                value={saga.genre ?? ''}
                onChange={(e) => handleSagaUpdate({ genre: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          {/* Writing mode */}
          <div>
            <label className="label-field mb-3">Mode d'écriture</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSagaUpdate({ writingMode: 'count' })}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                  saga.writingMode === 'count'
                    ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200'
                    : 'border-parchment-200 hover:border-parchment-400'
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  saga.writingMode === 'count' ? 'bg-bordeaux-100' : 'bg-parchment-200'
                )}>
                  <Hash className={cn('w-5 h-5', saga.writingMode === 'count' ? 'text-bordeaux-500' : 'text-ink-300')} />
                </div>
                <div>
                  <p className="font-display font-semibold text-ink-500 text-sm">Comptage de mots</p>
                  <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                    Vous écrivez ailleurs et saisissez manuellement le nombre de mots par scène.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSagaUpdate({ writingMode: 'write' })}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                  saga.writingMode === 'write'
                    ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200'
                    : 'border-parchment-200 hover:border-parchment-400'
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  saga.writingMode === 'write' ? 'bg-bordeaux-100' : 'bg-parchment-200'
                )}>
                  <PenLine className={cn('w-5 h-5', saga.writingMode === 'write' ? 'text-bordeaux-500' : 'text-ink-300')} />
                </div>
                <div>
                  <p className="font-display font-semibold text-ink-500 text-sm">Écriture intégrée</p>
                  <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                    Vous rédigez directement dans l'application. Le comptage est automatique.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Count unit */}
          <div>
            <label className="label-field mb-3">Unité de comptage</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSagaUpdate({ countUnit: 'words' })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                  saga.countUnit === 'words'
                    ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                    : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
                )}
              >
                Mots
              </button>
              <button
                type="button"
                onClick={() => handleSagaUpdate({ countUnit: 'characters' })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                  saga.countUnit === 'characters'
                    ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                    : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
                )}
              >
                Signes (espaces compris)
              </button>
            </div>
            <p className="text-xs text-ink-200 mt-1.5">
              {saga.countUnit === 'characters'
                ? 'Les objectifs et jauges seront basés sur le nombre de signes. Le nombre de mots sera affiché à titre informatif.'
                : 'Les objectifs et jauges seront basés sur le nombre de mots. Le nombre de signes sera affiché à titre informatif.'}
            </p>
          </div>
        </div>
      </div>

      {/* Book order */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Livres de la saga</h3>
        <p className="text-sm text-ink-300 mb-4">
          Glissez-déposez pour réordonner les tomes.
        </p>

        {sagaBooks.length === 0 ? (
          <p className="text-sm text-ink-200 italic">Aucun livre dans cette saga.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sagaBooks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sagaBooks.map((book) => (
                  <SortableBookItem key={book.id} book={book} onRemoveDisabled />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Danger zone */}
      <div className="card-fantasy p-6 border-red-100">
        <h3 className="font-display text-lg font-semibold text-red-600 mb-1">Zone de danger</h3>
        <p className="text-sm text-ink-300 mb-4">
          La suppression d'une saga est irréversible. Les livres ne seront pas supprimés mais perdront leur encyclopédie partagée.
        </p>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Supprimer la saga
        </button>
      </div>

      {showDeleteDialog && (
        <DeleteSagaDialog
          sagaTitle={saga.title}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}
