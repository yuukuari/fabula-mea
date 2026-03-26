import { useState } from 'react';
import { Plus, Globe, Edit, Trash2, X, ArrowLeft } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { WORLD_NOTE_CATEGORY_LABELS } from '@/lib/utils';
import type { WorldNoteCategory } from '@/types';

export function WorldPage() {
  const worldNotes = useBookStore((s) => s.worldNotes);
  const addWorldNote = useBookStore((s) => s.addWorldNote);
  const updateWorldNote = useBookStore((s) => s.updateWorldNote);
  const deleteWorldNote = useBookStore((s) => s.deleteWorldNote);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
          <button onClick={() => { deleteWorldNote(selectedNote.id); setSelectedId(null); }} className="btn-ghost text-red-500">
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
        </div>
        {showForm && <WorldNoteForm noteId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Univers & Glossaire</h2>
        <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle note
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
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Creer une note</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <div key={note.id} onClick={() => setSelectedId(note.id)} className="card-fantasy p-4 cursor-pointer">
              <span className="badge bg-parchment-200 text-ink-300 text-xs mb-2">{WORLD_NOTE_CATEGORY_LABELS[note.category]}</span>
              <h3 className="font-display font-bold text-ink-500 mt-1">{note.title}</h3>
              <p className="text-sm text-ink-300 mt-1 line-clamp-3">{note.content}</p>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (existing) {
      updateWorldNote(existing.id, { title, category, content });
    } else {
      addWorldNote({ title, category, content });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">{existing ? 'Modifier' : 'Nouvelle note'}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="label-field">Categorie</label>
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
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
