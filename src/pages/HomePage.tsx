import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Trash2, Users, MapPin, Film, Hash, PenLine, MessageSquare, Library, ChevronDown, ChevronRight, Settings, X } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useBookStore } from '@/store/useBookStore';
import { useSagaStore } from '@/store/useSagaStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewStore } from '@/store/useReviewStore';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { WritingMode, CountUnit, BookMeta } from '@/types';

function BookCard({ book, pendingCount, onSelect, onDelete }: {
  book: BookMeta;
  pendingCount?: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(book.id)}
      className={cn(
        'card-fantasy p-5 cursor-pointer group relative',
        'hover:shadow-lg hover:border-bordeaux-300 transition-all duration-200',
        'hover:-translate-y-0.5'
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(book.id); }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-200
                   hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
        title="Supprimer"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="w-12 h-12 bg-bordeaux-100 rounded-lg flex items-center justify-center mb-3">
        <BookOpen className="w-6 h-6 text-bordeaux-500" />
      </div>

      <h3 className="font-display text-lg font-semibold text-ink-500 mb-1 pr-8">{book.title}</h3>
      {book.author && <p className="text-sm text-ink-300 mb-1">par {book.author}</p>}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {book.genre && (
          <span className="text-xs bg-gold-100 text-gold-600 px-2 py-0.5 rounded-full">{book.genre}</span>
        )}
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full flex items-center gap-1',
          book.writingMode === 'write' ? 'bg-bordeaux-100 text-bordeaux-600' : 'bg-parchment-200 text-ink-300'
        )}>
          {book.writingMode === 'write'
            ? <><PenLine className="w-2.5 h-2.5" /> Écriture</>
            : <><Hash className="w-2.5 h-2.5" /> Comptage</>}
        </span>
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-parchment-200 text-xs text-ink-200">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{book.charactersCount}</span>
        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{book.chaptersCount} ch.</span>
        <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" />{book.scenesCount} sc.</span>
      </div>

      <p className="text-[10px] text-ink-200 mt-2">
        Modifié le {new Date(book.updatedAt).toLocaleDateString('fr-FR')}
      </p>

      {(pendingCount ?? 0) > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{pendingCount} commentaire{pendingCount! > 1 ? 's' : ''} en attente</span>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { books, sagas, createBook, deleteBook, selectBook, createSaga } = useLibraryStore();
  const { initNewBook, loadBook } = useBookStore();
  const { initNewSaga } = useSagaStore();
  const user = useAuthStore((s) => s.user);
  const reviewSessions = useReviewStore((s) => s.sessions);
  const loadReviewSessions = useReviewStore((s) => s.loadSessions);

  // Load review sessions to show pending comments badges
  useEffect(() => {
    if (user) loadReviewSessions();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute pending comments count per book (exclude closed sessions)
  const pendingByBook = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of reviewSessions) {
      if (s.status !== 'closed' && s.pendingCommentsCount > 0) {
        map[s.bookId] = (map[s.bookId] || 0) + s.pendingCommentsCount;
      }
    }
    return map;
  }, [reviewSessions]);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [writingMode, setWritingMode] = useState<WritingMode | null>(null);
  const [countUnit, setCountUnit] = useState<CountUnit>('words');
  const [sagaChoice, setSagaChoice] = useState<'standalone' | 'existing' | 'new'>('standalone');
  const [selectedSagaId, setSelectedSagaId] = useState<string>('');
  const [newSynopsis, setNewSynopsis] = useState('');
  const [newSagaTitle, setNewSagaTitle] = useState('');
  const [newSagaSynopsis, setNewSagaSynopsis] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [collapsedSagas, setCollapsedSagas] = useState<Set<string>>(new Set());
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const toggleSagaCollapse = (sagaId: string) => {
    setCollapsedSagas((prev) => {
      const next = new Set(prev);
      if (next.has(sagaId)) next.delete(sagaId);
      else next.add(sagaId);
      return next;
    });
  };

  const isDirty = useCallback(() => {
    return !!(
      newTitle || newAuthor || newGenre || writingMode || countUnit !== 'words' ||
      sagaChoice !== 'standalone' || selectedSagaId || newSynopsis ||
      newSagaTitle || newSagaSynopsis
    );
  }, [newTitle, newAuthor, newGenre, writingMode, countUnit, sagaChoice, selectedSagaId, newSynopsis, newSagaTitle, newSagaSynopsis]);

  const handleCloseCreate = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      handleCancelCreate();
    }
  };

  // Resolve effective values based on saga choice
  const selectedSaga = sagaChoice === 'existing' ? sagas.find((s) => s.id === selectedSagaId) : null;
  const effectiveAuthor = sagaChoice === 'existing' && selectedSaga ? selectedSaga.author ?? '' : newAuthor;
  const effectiveGenre = sagaChoice === 'existing' && selectedSaga ? selectedSaga.genre ?? '' : newGenre;
  const effectiveWritingMode = sagaChoice === 'existing' && selectedSaga ? selectedSaga.writingMode : writingMode;
  const effectiveCountUnit = sagaChoice === 'existing' && selectedSaga ? selectedSaga.countUnit : countUnit;

  const handleCreate = () => {
    if (!newTitle.trim() || !effectiveWritingMode) return;

    let sagaId: string | undefined;
    if (sagaChoice === 'new' && newSagaTitle.trim()) {
      sagaId = createSaga(newSagaTitle.trim(), { description: newSagaSynopsis.trim(), author: newAuthor.trim(), genre: newGenre.trim(), writingMode: effectiveWritingMode, countUnit: effectiveCountUnit });
      initNewSaga(sagaId, newSagaTitle.trim(), newSagaSynopsis.trim());
    } else if (sagaChoice === 'existing' && selectedSagaId) {
      sagaId = selectedSagaId;
    }

    // Resolve layout from saga if applicable
    const effectiveSaga = sagaId ? sagas.find((s) => s.id === sagaId) : null;
    const effectiveLayout = effectiveSaga?.layout;

    const bookId = createBook(newTitle.trim(), effectiveAuthor.trim(), effectiveGenre.trim(), effectiveWritingMode, effectiveCountUnit, sagaId);
    initNewBook(bookId, newTitle.trim(), effectiveAuthor.trim(), effectiveGenre.trim(), effectiveWritingMode, effectiveCountUnit, sagaId, effectiveLayout);
    if (newSynopsis.trim()) {
      useBookStore.getState().updateProject({ synopsis: newSynopsis.trim() });
    }
    selectBook(bookId);
    setNewTitle('');
    setNewSynopsis('');
    setNewAuthor('');
    setNewGenre('');
    setWritingMode(null);
    setCountUnit('words');
    setSagaChoice('standalone');
    setSelectedSagaId('');
    setNewSagaTitle('');
    setNewSagaSynopsis('');
    setShowCreate(false);
    navigate('/encyclopedia');
  };

  const handleCancelCreate = () => {
    setShowCreate(false);
    setNewSynopsis('');
    setWritingMode(null);
    setCountUnit('words');
    setSagaChoice('standalone');
    setSelectedSagaId('');
    setNewSagaTitle('');
    setNewSagaSynopsis('');
  };

  const handleSelect = (bookId: string) => {
    selectBook(bookId);
    loadBook(bookId);
    navigate('/encyclopedia');
  };

  const handleDelete = (bookId: string) => {
    deleteBook(bookId);
    setDeleteTarget(null);
  };

  const sortedBooks = [...books].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-parchment-50">
      {/* Title section */}
      <div className="max-w-5xl mx-auto px-8 pt-8 pb-2">
        <h2 className="font-display text-2xl font-bold text-ink-500">Mes livres</h2>
        <p className="text-ink-300 text-sm mt-1">Choisissez un livre ou créez-en un nouveau</p>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Create new book button */}
          <button
            onClick={() => setShowCreate(true)}
            className="w-full mb-8 flex items-center justify-center gap-3 px-6 py-5
                       border-2 border-dashed border-parchment-300 rounded-xl
                       text-ink-300 hover:border-bordeaux-300 hover:text-bordeaux-500
                       hover:bg-bordeaux-50/50 transition-all duration-200 group"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-display text-lg">Nouveau livre</span>
          </button>

        {/* Create new book modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
            <div className="absolute inset-0 bg-black/40" onClick={handleCloseCreate} />
            <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-3xl mx-4 my-4 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-parchment-300 flex-shrink-0">
                <h2 className="font-display text-xl font-bold text-ink-500">
                  Nouveau livre
                </h2>
                <button onClick={handleCloseCreate} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Step 1: Type choice */}
                <div>
                  <label className="label-field mb-3">Type de projet</label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => { setSagaChoice('standalone'); setSelectedSagaId(''); setNewSagaTitle(''); }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                        sagaChoice === 'standalone'
                          ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                          : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
                      )}
                    >
                      <BookOpen className="w-4 h-4" />
                      Livre indépendant
                    </button>
                    {sagas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSagaChoice('existing'); setNewSagaTitle(''); if (!selectedSagaId && sagas.length > 0) setSelectedSagaId(sagas[0].id); }}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                          sagaChoice === 'existing'
                            ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                            : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
                        )}
                      >
                        <Library className="w-4 h-4" />
                        Saga existante
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSagaChoice('new'); setSelectedSagaId(''); }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                        sagaChoice === 'new'
                          ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                          : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      Nouvelle saga
                    </button>
                  </div>
                  <p className="text-xs text-ink-200 mt-1.5">
                    {sagaChoice === 'standalone'
                      ? 'Ce livre aura sa propre encyclopédie (personnages, lieux, univers, cartes).'
                      : 'Les livres d\'une saga partagent la même encyclopédie (personnages, lieux, univers, cartes).'}
                  </p>
                </div>

                {/* Existing saga: select + saga info + book title only */}
                {sagaChoice === 'existing' && sagas.length > 0 && (
                  <>
                    <div>
                      <label className="label-field">Saga</label>
                      <select
                        className="input-field"
                        value={selectedSagaId}
                        onChange={(e) => setSelectedSagaId(e.target.value)}
                      >
                        {sagas.map((s) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                      {selectedSaga && (
                        <div className="mt-3 text-xs text-ink-300 space-y-0.5">
                          {selectedSaga.author && <p>Auteur : <span className="text-ink-400">{selectedSaga.author}</span></p>}
                          {selectedSaga.genre && <p>Genre : <span className="text-ink-400">{selectedSaga.genre}</span></p>}
                          <p>Mode : <span className="text-ink-400">{selectedSaga.writingMode === 'write' ? 'Écriture intégrée' : 'Comptage de mots'}</span></p>
                          <p>Unité : <span className="text-ink-400">{selectedSaga.countUnit === 'characters' ? 'Signes' : 'Mots'}</span></p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="label-field">Titre du livre *</label>
                      <input
                        className="input-field"
                        placeholder="Le titre de ce nouveau tome"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="label-field">Synopsis</label>
                      <textarea
                        className="textarea-field"
                        placeholder="De quoi parle ce tome ?"
                        value={newSynopsis}
                        onChange={(e) => setNewSynopsis(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* New saga */}
                {sagaChoice === 'new' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label-field">Nom de la saga *</label>
                        <input
                          className="input-field"
                          placeholder="Le nom de votre saga"
                          value={newSagaTitle}
                          onChange={(e) => setNewSagaTitle(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="label-field">Titre du premier livre *</label>
                        <input
                          className="input-field"
                          placeholder="Le titre du premier tome"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label-field">Synopsis de la saga</label>
                        <textarea
                          className="textarea-field"
                          placeholder="De quoi parle votre saga ?"
                          value={newSagaSynopsis}
                          onChange={(e) => setNewSagaSynopsis(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="label-field">Synopsis du livre</label>
                        <textarea
                          className="textarea-field"
                          placeholder="De quoi parle ce premier tome ?"
                          value={newSynopsis}
                          onChange={(e) => setNewSynopsis(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Standalone: title + synopsis */}
                {sagaChoice === 'standalone' && (
                  <>
                    <div>
                      <label className="label-field">Titre du livre *</label>
                      <input
                        className="input-field"
                        placeholder="Le titre de votre livre"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="label-field">Synopsis</label>
                      <textarea
                        className="textarea-field"
                        placeholder="De quoi parle votre livre ?"
                        value={newSynopsis}
                        onChange={(e) => setNewSynopsis(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Author + Genre */}
                {sagaChoice !== 'existing' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Auteur</label>
                      <input
                        className="input-field"
                        placeholder="Votre nom"
                        value={newAuthor}
                        onChange={(e) => setNewAuthor(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-field">Genre</label>
                      <input
                        className="input-field"
                        placeholder="Fantasy, SF, Romance..."
                        value={newGenre}
                        onChange={(e) => setNewGenre(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Writing mode */}
                {sagaChoice !== 'existing' && (
                  <div>
                    <label className="label-field mb-3 flex items-center gap-1.5">
                      Mode d'écriture <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setWritingMode('count')}
                        className={cn(
                          'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                          writingMode === 'count'
                            ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200'
                            : 'border-parchment-200 hover:border-parchment-400'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                          writingMode === 'count' ? 'bg-bordeaux-100' : 'bg-parchment-200'
                        )}>
                          <Hash className={cn('w-5 h-5', writingMode === 'count' ? 'text-bordeaux-500' : 'text-ink-300')} />
                        </div>
                        <div>
                          <p className="font-display font-semibold text-ink-500 text-sm">Comptage de mots</p>
                          <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                            Vous écrivez sur papier ou dans un autre logiciel. Vous renseignez manuellement le nombre de mots par scène.
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWritingMode('write')}
                        className={cn(
                          'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                          writingMode === 'write'
                            ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200'
                            : 'border-parchment-200 hover:border-parchment-400'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                          writingMode === 'write' ? 'bg-bordeaux-100' : 'bg-parchment-200'
                        )}>
                          <PenLine className={cn('w-5 h-5', writingMode === 'write' ? 'text-bordeaux-500' : 'text-ink-300')} />
                        </div>
                        <div>
                          <p className="font-display font-semibold text-ink-500 text-sm">Écriture intégrée</p>
                          <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                            Vous rédigez directement dans l'application. Le nombre de mots est calculé automatiquement à partir de votre texte.
                          </p>
                        </div>
                      </button>
                    </div>
                    {!writingMode && newTitle.trim() && (
                      <p className="text-xs text-red-400 mt-2">Veuillez choisir un mode d'écriture pour continuer.</p>
                    )}
                  </div>
                )}

                {/* Count unit */}
                {sagaChoice !== 'existing' && (
                  <div>
                    <label className="label-field mb-3">Unité de comptage</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setCountUnit('words')}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                          countUnit === 'words'
                            ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                            : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
                        )}
                      >
                        Mots
                      </button>
                      <button
                        type="button"
                        onClick={() => setCountUnit('characters')}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                          countUnit === 'characters'
                            ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                            : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
                        )}
                      >
                        Signes (espaces compris)
                      </button>
                    </div>
                    <p className="text-xs text-ink-200 mt-1.5">
                      {countUnit === 'characters'
                        ? 'Les objectifs et jauges seront basés sur le nombre de signes. Le nombre de mots sera affiché à titre informatif.'
                        : 'Les objectifs et jauges seront basés sur le nombre de mots. Le nombre de signes sera affiché à titre informatif.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-parchment-300 flex-shrink-0">
                <button onClick={handleCloseCreate} className="btn-secondary">
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  className="btn-primary"
                  disabled={!newTitle.trim() || !effectiveWritingMode || (sagaChoice === 'new' && !newSagaTitle.trim()) || (sagaChoice === 'existing' && !selectedSagaId)}
                >
                  Créer
                </button>
              </div>
            </div>
          </div>

        )}

        {/* Book list */}
        {sortedBooks.length === 0 && sagas.length === 0 && !showCreate ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-parchment-300 mx-auto mb-4" />
            <p className="font-display text-xl text-ink-300 mb-2">Aucun livre</p>
            <p className="text-sm text-ink-200">
              Creez votre premier livre pour commencer
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Saga groups */}
            {sagas.map((saga) => {
              const sagaBooks = saga.bookIds
                .map((bid) => books.find((b) => b.id === bid))
                .filter((b): b is BookMeta => !!b);
              const isCollapsed = collapsedSagas.has(saga.id);
              return (
                <div key={saga.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => sagaBooks.length > 0 ? toggleSagaCollapse(saga.id) : undefined}
                      className={cn('flex items-center gap-2 group', sagaBooks.length === 0 && 'cursor-default')}
                    >
                      {sagaBooks.length > 0 ? (
                        isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-ink-300" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-ink-300" />
                        )
                      ) : (
                        <div className="w-4" />
                      )}
                      <Library className="w-4 h-4 text-bordeaux-400" />
                      <span className="font-display text-lg font-semibold text-ink-500">{saga.title}</span>
                      <span className="text-xs text-ink-200 ml-1">
                        {sagaBooks.length === 0 ? '(aucun livre)' : `(${sagaBooks.length} tome${sagaBooks.length > 1 ? 's' : ''})`}
                      </span>
                    </button>
                    <button
                      onClick={() => navigate(`/saga/${saga.id}`)}
                      className="p-1.5 rounded-lg text-ink-200 hover:text-bordeaux-500 hover:bg-bordeaux-50 transition-all"
                      title="Gérer la saga"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                  {!isCollapsed && sagaBooks.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pl-6 border-l-2 border-bordeaux-200">
                      {sagaBooks.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          pendingCount={pendingByBook[book.id]}
                          onSelect={handleSelect}
                          onDelete={setDeleteTarget}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Standalone books */}
            {(() => {
              const standaloneBooks = sortedBooks.filter((b) => !b.sagaId);
              if (standaloneBooks.length === 0) return null;
              return (
                <div>
                  {sagas.some((sg) => sortedBooks.some((b) => b.sagaId === sg.id)) && (
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-ink-300" />
                      <span className="font-display text-lg font-semibold text-ink-500">Livres indépendants</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {standaloneBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        pendingCount={pendingByBook[book.id]}
                        onSelect={handleSelect}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer ce livre ?"
        description="Cette action est irreversible. Toutes les donnees de ce livre seront perdues."
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnsavedConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Modifications non enregistrées</h3>
            <p className="text-sm text-ink-300 mb-6">Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUnsavedConfirm(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={() => { setShowUnsavedConfirm(false); handleCancelCreate(); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-400 hover:bg-parchment-100 transition-colors">Quitter</button>
              <button onClick={() => { setShowUnsavedConfirm(false); handleCreate(); }} className="btn-primary text-sm" disabled={!newTitle.trim() || !effectiveWritingMode || (sagaChoice === 'new' && !newSagaTitle.trim()) || (sagaChoice === 'existing' && !selectedSagaId)}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
