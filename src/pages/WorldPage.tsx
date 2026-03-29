import { useState, useEffect } from 'react';
import { Plus, Globe, Edit, Trash2, X, ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { WORLD_NOTE_CATEGORY_LABELS } from '@/lib/utils';
import type { WorldNoteCategory } from '@/types';

export function WorldPage() {
  const [searchParams] = useSearchParams();
  const worldNotes = useBookStore((s) => s.worldNotes);
  const addWorldNote = useBookStore((s) => s.addWorldNote);
  const updateWorldNote = useBookStore((s) => s.updateWorldNote);
  const deleteWorldNote = useBookStore((s) => s.deleteWorldNote);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('noteId')
  );

  useEffect(() => {
    const id = searchParams.get('noteId');
    if (id) setSelectedId(id);
  }, [searchParams]);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const filtered = filterCategory
    ? worldNotes.filter((n) => n.category === filterCategory)
    : worldNotes;

  const selectedNote = selectedId ? worldNotes.find((n) => n.id === selectedId) : null;

  if (selectedNote) {
    return (
      <div className="page-container max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedId(null)} className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1" />
          <button onClick={() => { setEditingId(selectedNote.id); setShowForm(true); }} className="btn-secondary flex items-center gap-2">
            <Edit className="w-4 h-4" /> Modifier
          </button>
          <button onClick={() => setDeleteId(selectedNote.id)} className="btn-ghost text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="card-fantasy p-6">
          {selectedNote.imageUrl && (
            <img src={selectedNote.imageUrl} alt="" className="w-full h-48 object-cover rounded-lg mb-4" />
          )}
          <span className="badge bg-parchment-200 text-ink-400 mb-2">{WORLD_NOTE_CATEGORY_LABELS[selectedNote.category]}</span>
          <h2 className="font-display text-2xl font-bold text-ink-500 mt-2 mb-4">{selectedNote.title}</h2>
          <div className="text-ink-300 font-serif whitespace-pre-wrap leading-relaxed">{selectedNote.content}</div>

          {(selectedNote.linkedNoteIds ?? []).length > 0 && (
            <div className="mt-6 pt-4 border-t border-parchment-200">
              <h4 className="font-display font-semibold text-ink-400 mb-2">Fiches liées</h4>
              <div className="flex flex-wrap gap-2">
                {(selectedNote.linkedNoteIds ?? []).map((id) => {
                  const linked = worldNotes.find((n) => n.id === id);
                  return linked ? (
                    <button
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className="badge bg-parchment-200 text-ink-400 cursor-pointer hover:bg-parchment-300"
                    >
                      {linked.title}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!deleteId}
          title="Supprimer la note"
          description="Cette action est irréversible."
          onConfirm={() => { if (deleteId) { deleteWorldNote(deleteId); setSelectedId(null); } setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
        {showForm && <WorldNoteForm noteId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Univers & Glossaire</h2>
        <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouvelle note</span>
        </button>
      </div>

      {worldNotes.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterCategory('')}
            className={`badge cursor-pointer ${!filterCategory ? 'bg-bordeaux-500 text-white' : 'bg-parchment-200 text-ink-400'}`}
          >
            Toutes
          </button>
          {Object.entries(WORLD_NOTE_CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`badge cursor-pointer ${filterCategory === key ? 'bg-bordeaux-500 text-white' : 'bg-parchment-200 text-ink-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {worldNotes.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Aucune note"
          description="Creez des notes pour decrire votre univers : histoire, culture, magie, politique..."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Créer une note</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <div key={note.id} onClick={() => setSelectedId(note.id)} className="card-fantasy cursor-pointer overflow-hidden">
              {note.imageUrl ? (
                <img src={note.imageUrl} alt={note.title} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-parchment-200 flex items-center justify-center">
                  <Globe className="w-12 h-12 text-ink-100" />
                </div>
              )}
              <div className="p-4">
                <span className="badge bg-parchment-200 text-ink-300 text-xs mb-2">{WORLD_NOTE_CATEGORY_LABELS[note.category]}</span>
                <h3 className="font-display font-bold text-ink-500 mt-1">{note.title}</h3>
                <p className="text-sm text-ink-300 mt-1 line-clamp-2">{note.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <WorldNoteForm noteId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
    </div>
  );
}

function WorldNoteForm({ noteId, onClose }: { noteId: string | null; onClose: () => void }) {
  const worldNotes = useBookStore((s) => s.worldNotes);
  const addWorldNote = useBookStore((s) => s.addWorldNote);
  const updateWorldNote = useBookStore((s) => s.updateWorldNote);
  const existing = noteId ? worldNotes.find((n) => n.id === noteId) : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<WorldNoteCategory>(existing?.category ?? 'custom');
  const [content, setContent] = useState(existing?.content ?? '');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(existing?.linkedNoteIds ?? []);

  const otherNotes = worldNotes.filter((n) => n.id !== noteId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data = { title, category, content, imageUrl, linkedNoteIds };

    if (existing) {
      updateWorldNote(existing.id, data);
    } else {
      addWorldNote(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 my-4">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300">
          <h3 className="font-display text-xl font-bold text-ink-500">{existing ? 'Modifier la note' : 'Nouvelle note'}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <ImageUpload value={imageUrl} onChange={setImageUrl} />

          <div>
            <label className="label-field">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="label-field">Catégorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as WorldNoteCategory)} className="input-field">
              {Object.entries(WORLD_NOTE_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Contenu</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} className="textarea-field" rows={8} />
          </div>

          {otherNotes.length > 0 && (
            <div>
              <label className="label-field">Fiches liées</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {otherNotes.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 text-sm text-ink-300">
                    <input
                      type="checkbox"
                      checked={linkedNoteIds.includes(n.id)}
                      onChange={(e) => {
                        if (e.target.checked) setLinkedNoteIds([...linkedNoteIds, n.id]);
                        else setLinkedNoteIds(linkedNoteIds.filter((id) => id !== n.id));
                      }}
                      className="rounded border-parchment-300"
                    />
                    <span className="badge bg-parchment-200 text-ink-300 text-xs mr-1">{WORLD_NOTE_CATEGORY_LABELS[n.category]}</span>
                    {n.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-parchment-300">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
