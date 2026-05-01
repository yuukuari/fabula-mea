import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Globe, Edit, Trash2, X, ArrowLeft, BookText, Search, GripVertical, MapPin } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { GlossaryBadge } from '@/components/encyclopedia/GlossaryBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn, WORLD_NOTE_CATEGORY_LABELS, WORLD_NOTE_CATEGORY_COLORS } from '@/lib/utils';
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
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorldNote, WorldNoteCategory } from '@/types';

function SortableWorldNoteCard({ note, onClick }: { note: WorldNote; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: note.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sort">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-10 p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-100 opacity-0 group-hover/sort:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <WorldNoteCard note={note} onClick={onClick} />
    </div>
  );
}

function WorldNoteCard({ note, onClick }: { note: WorldNote; onClick: () => void }) {
  return (
    <div onClick={onClick} className="card-fantasy cursor-pointer overflow-hidden">
      {note.imageUrl ? (
        <img src={note.imageUrl} alt={note.title} className="w-full h-36 object-contain bg-parchment-100" />
      ) : (
        <div className="w-full h-36 bg-parchment-200 flex items-center justify-center">
          <Globe className="w-12 h-12 text-ink-100" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={cn('badge text-xs', WORLD_NOTE_CATEGORY_COLORS[note.category] ?? 'bg-parchment-200 text-ink-300')}>{WORLD_NOTE_CATEGORY_LABELS[note.category]}</span>
          {note.inGlossary && (
            <BookText className="w-3.5 h-3.5 text-bordeaux-400" />
          )}
        </div>
        <h3 className="font-display font-bold text-ink-500">{note.title}</h3>
        <p className="text-sm text-ink-300 mt-1 line-clamp-2">{note.content}</p>
      </div>
    </div>
  );
}

export function WorldPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { worldNotes, places, updateWorldNote, deleteWorldNote, reorderWorldNotes } = useEncyclopediaStore();

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
  const [filterPlaceId, setFilterPlaceId] = useState<string>('');
  const [search, setSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sorted = useMemo(
    () => [...worldNotes].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [worldNotes],
  );

  const filtered = sorted
    .filter((n) => !filterCategory || n.category === filterCategory)
    .filter((n) => !filterPlaceId || (n.connectedPlaceIds ?? []).includes(filterPlaceId))
    .filter((n) => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));

  const isSearchingOrFiltering = search.length > 0 || filterCategory.length > 0 || filterPlaceId.length > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((n) => n.id === active.id);
    const newIndex = sorted.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderWorldNotes(reordered.map((n) => n.id));
  }

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
            <img src={selectedNote.imageUrl} alt="" className="w-full h-48 object-contain rounded-lg mb-4 bg-parchment-100" />
          )}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn('badge', WORLD_NOTE_CATEGORY_COLORS[selectedNote.category] ?? 'bg-parchment-200 text-ink-400')}>{WORLD_NOTE_CATEGORY_LABELS[selectedNote.category]}</span>
            <GlossaryBadge
              inGlossary={selectedNote.inGlossary ?? false}
              onToggle={(next) => updateWorldNote(selectedNote.id, { inGlossary: next })}
            />
          </div>
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

          {(selectedNote.connectedPlaceIds ?? []).length > 0 && (
            <div className="mt-6 pt-4 border-t border-parchment-200">
              <h4 className="font-display font-semibold text-ink-400 mb-2">Lieux liés</h4>
              <div className="flex flex-wrap gap-2">
                {(selectedNote.connectedPlaceIds ?? []).map((id) => {
                  const place = places.find((p) => p.id === id);
                  return place ? (
                    <button
                      key={id}
                      onClick={() => navigate(`/places?placeId=${place.id}`)}
                      className="badge bg-parchment-200 text-ink-400 cursor-pointer hover:bg-parchment-300 flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" />
                      {place.name}
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
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouvelle fiche</span>
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
              className={cn('badge cursor-pointer', filterCategory === key ? 'ring-2 ring-bordeaux-400 ring-offset-1' : '', WORLD_NOTE_CATEGORY_COLORS[key] ?? 'bg-parchment-200 text-ink-400')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {worldNotes.length > 0 && places.length > 0 && (
        <div className="mb-6">
          <label className="label-field flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> Filtrer par lieu
          </label>
          <select
            value={filterPlaceId}
            onChange={(e) => setFilterPlaceId(e.target.value)}
            className="input-field"
          >
            <option value="">Tous les lieux</option>
            {[...places]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {worldNotes.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-200" />
          <input
            type="text"
            placeholder="Rechercher une fiche univers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {worldNotes.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Aucune fiche"
          description="Creez des fiches pour décrire votre univers : histoire, culture, magie, politique..."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Créer une fiche</button>}
        />
      ) : isSearchingOrFiltering ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <WorldNoteCard key={note.id} note={note} onClick={() => setSelectedId(note.id)} />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((note) => (
                <SortableWorldNoteCard key={note.id} note={note} onClick={() => setSelectedId(note.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showForm && <WorldNoteForm noteId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
    </div>
  );
}

function WorldNoteForm({ noteId, onClose }: { noteId: string | null; onClose: () => void }) {
  const { worldNotes, places, addWorldNote, updateWorldNote } = useEncyclopediaStore();
  const existing = noteId ? worldNotes.find((n) => n.id === noteId) : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<WorldNoteCategory>(existing?.category ?? 'custom');
  const [content, setContent] = useState(existing?.content ?? '');
  const [inGlossary, setInGlossary] = useState(existing?.inGlossary ?? false);
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(existing?.linkedNoteIds ?? []);
  const [connectedPlaceIds, setConnectedPlaceIds] = useState<string[]>(existing?.connectedPlaceIds ?? []);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const otherNotes = worldNotes.filter((n) => n.id !== noteId);
  const sortedPlaces = useMemo(
    () => [...places].sort((a, b) => a.name.localeCompare(b.name)),
    [places],
  );

  const isDirty = useCallback(() => {
    if (!existing) {
      return !!(title || content || imageUrl || inGlossary || linkedNoteIds.length > 0 || connectedPlaceIds.length > 0 || category !== 'custom');
    }
    return (
      title !== (existing.title ?? '') ||
      category !== (existing.category ?? 'custom') ||
      content !== (existing.content ?? '') ||
      inGlossary !== (existing.inGlossary ?? false) ||
      imageUrl !== existing.imageUrl ||
      JSON.stringify(linkedNoteIds) !== JSON.stringify(existing.linkedNoteIds ?? []) ||
      JSON.stringify(connectedPlaceIds) !== JSON.stringify(existing.connectedPlaceIds ?? [])
    );
  }, [title, category, content, inGlossary, imageUrl, linkedNoteIds, connectedPlaceIds, existing]);

  const handleSave = () => {
    if (!title.trim()) return;
    const data = { title, category, content, inGlossary, imageUrl, linkedNoteIds, connectedPlaceIds };
    if (existing) {
      updateWorldNote(existing.id, data);
    } else {
      addWorldNote(data);
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-2xl mx-4 my-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300 flex-shrink-0">
          <h3 className="font-display text-xl font-bold text-ink-500">{existing ? 'Modifier la fiche' : 'Nouvelle fiche'}</h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

          <label className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer">
            <input
              type="checkbox"
              checked={inGlossary}
              onChange={(e) => setInGlossary(e.target.checked)}
              className="rounded border-parchment-300 accent-bordeaux-500"
            />
            Inclure dans le glossaire du livre
          </label>

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
                    <span className={cn('badge text-xs mr-1', WORLD_NOTE_CATEGORY_COLORS[n.category] ?? 'bg-parchment-200 text-ink-300')}>{WORLD_NOTE_CATEGORY_LABELS[n.category]}</span>
                    {n.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          {sortedPlaces.length > 0 && (
            <div>
              <label className="label-field">Lieux liés</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sortedPlaces.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-ink-300">
                    <input
                      type="checkbox"
                      checked={connectedPlaceIds.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) setConnectedPlaceIds([...connectedPlaceIds, p.id]);
                        else setConnectedPlaceIds(connectedPlaceIds.filter((id) => id !== p.id));
                      }}
                      className="rounded border-parchment-300"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          </div>
          <div className="flex justify-end gap-3 p-6 border-t border-parchment-300 flex-shrink-0">
            <button type="button" onClick={handleClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>

      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnsavedConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Modifications non enregistrées</h3>
            <p className="text-sm text-ink-300 mb-6">Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUnsavedConfirm(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={() => { setShowUnsavedConfirm(false); onClose(); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-400 hover:bg-parchment-100 transition-colors">Quitter</button>
              <button onClick={() => { setShowUnsavedConfirm(false); handleSave(); }} className="btn-primary text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
