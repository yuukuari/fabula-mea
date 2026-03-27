import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Feather, Trash2, Users, MapPin, Film } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useBookStore } from '@/store/useBookStore';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function HomePage() {
  const navigate = useNavigate();
  const { books, createBook, deleteBook, selectBook } = useLibraryStore();
  const { initNewBook, loadBook } = useBookStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const bookId = createBook(newTitle.trim(), newAuthor.trim(), newGenre.trim());
    initNewBook(bookId, newTitle.trim(), newAuthor.trim(), newGenre.trim());
    selectBook(bookId);
    setNewTitle('');
    setNewAuthor('');
    setNewGenre('');
    setShowCreate(false);
    navigate('/characters');
  };

  const handleSelect = (bookId: string) => {
    selectBook(bookId);
    loadBook(bookId);
    navigate('/characters');
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
      {/* Header */}
      <header className="border-b border-parchment-300 bg-parchment-100/50">
        <div className="max-w-5xl mx-auto px-8 py-12">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-bordeaux-500 rounded-xl flex items-center justify-center shadow-lg">
              <Feather className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-ink-500">
                Ecrire Mon Livre
              </h1>
              <p className="text-ink-300 text-sm mt-1">
                Choisissez un livre ou creez-en un nouveau
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Create new book */}
        {!showCreate ? (
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
        ) : (
          <div className="mb-8 card-fantasy p-6">
            <h2 className="font-display text-xl font-semibold text-ink-500 mb-4">
              Nouveau livre
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label-field">Titre *</label>
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
            <div className="flex gap-3">
              <button onClick={handleCreate} className="btn-primary" disabled={!newTitle.trim()}>
                Creer
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-ghost">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Book list */}
        {sortedBooks.length === 0 && !showCreate ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-parchment-300 mx-auto mb-4" />
            <p className="font-display text-xl text-ink-300 mb-2">Aucun livre</p>
            <p className="text-sm text-ink-200">
              Creez votre premier livre pour commencer
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => handleSelect(book.id)}
                className={cn(
                  'card-fantasy p-5 cursor-pointer group relative',
                  'hover:shadow-lg hover:border-bordeaux-300 transition-all duration-200',
                  'hover:-translate-y-0.5'
                )}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(book.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-200
                             hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100
                             transition-all"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Book icon */}
                <div className="w-12 h-12 bg-bordeaux-100 rounded-lg flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 text-bordeaux-500" />
                </div>

                <h3 className="font-display text-lg font-semibold text-ink-500 mb-1 pr-8">
                  {book.title}
                </h3>
                {book.author && (
                  <p className="text-sm text-ink-300 mb-1">par {book.author}</p>
                )}
                {book.genre && (
                  <span className="inline-block text-xs bg-gold-100 text-gold-600 px-2 py-0.5 rounded-full mb-3">
                    {book.genre}
                  </span>
                )}

                {/* Stats */}
                <div className="flex gap-4 mt-3 pt-3 border-t border-parchment-200 text-xs text-ink-200">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {book.charactersCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {book.chaptersCount} ch.
                  </span>
                  <span className="flex items-center gap-1">
                    <Film className="w-3.5 h-3.5" />
                    {book.scenesCount} sc.
                  </span>
                </div>

                <p className="text-[10px] text-ink-200 mt-2">
                  Modifie le {new Date(book.updatedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            ))}
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
    </div>
  );
}
