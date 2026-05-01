import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, MapPin, Search, Edit, Trash2, ArrowLeft, X, Map, BookText, GripVertical } from 'lucide-react';
import { GlossaryBadge } from '@/components/encyclopedia/GlossaryBadge';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PlaceMapLinker } from '@/components/maps/PlaceMapLinker';
import { PLACE_TYPE_LABELS } from '@/lib/utils';
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
import type { Place, PlaceType } from '@/types';

function SortablePlaceCard({ place, onClick }: { place: Place; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: place.id });
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
      <PlaceCard place={place} onClick={onClick} />
    </div>
  );
}

function PlaceCard({ place, onClick }: { place: Place; onClick: () => void }) {
  return (
    <div onClick={onClick} className="card-fantasy cursor-pointer overflow-hidden">
      {place.imageUrl ? (
        <img src={place.imageUrl} alt={place.name} className="w-full h-36 object-contain bg-parchment-100" />
      ) : (
        <div className="w-full h-36 bg-parchment-200 flex items-center justify-center">
          <MapPin className="w-12 h-12 text-ink-100" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-bold text-ink-500">{place.name}</h3>
          <span className="badge bg-parchment-200 text-ink-300 text-xs">{PLACE_TYPE_LABELS[place.type]}</span>
          {place.inGlossary && (
            <BookText className="w-3.5 h-3.5 text-bordeaux-400" />
          )}
        </div>
        {place.description && (
          <p className="text-sm text-ink-300 mt-1 line-clamp-2">{place.description}</p>
        )}
      </div>
    </div>
  );
}

export function PlacesPage() {
  const { places, maps: rawMaps, addPlace, updatePlace, deletePlace, reorderPlaces } = useEncyclopediaStore();
  const maps = rawMaps ?? [];
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMapLinker, setShowMapLinker] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('placeId')
  );

  // Sync selected place when URL param changes (e.g. from search dialog while already on this page)
  useEffect(() => {
    const id = searchParams.get('placeId');
    if (id) setSelectedId(id);
  }, [searchParams]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sorted = useMemo(
    () => [...places].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [places],
  );

  const filtered = sorted.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSearching = search.length > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((p) => p.id === active.id);
    const newIndex = sorted.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderPlaces(reordered.map((p) => p.id));
  }

  const selectedPlace = selectedId ? places.find((p) => p.id === selectedId) : null;

  if (selectedPlace) {
    return (
      <div className="page-container max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedId(null)} className="btn-ghost p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button onClick={() => { setEditingId(selectedPlace.id); setShowForm(true); }} className="btn-secondary flex items-center gap-2">
            <Edit className="w-4 h-4" /> Modifier
          </button>
          <button onClick={() => setDeleteId(selectedPlace.id)} className="btn-ghost text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="card-fantasy p-6">
          {selectedPlace.imageUrl && (
            <img src={selectedPlace.imageUrl} alt={selectedPlace.name} className="w-full h-64 object-contain rounded-lg mb-4 bg-parchment-100" />
          )}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="font-display text-3xl font-bold text-ink-500">{selectedPlace.name}</h2>
            <span className="badge bg-parchment-200 text-ink-400">{PLACE_TYPE_LABELS[selectedPlace.type]}</span>
            <GlossaryBadge
              inGlossary={selectedPlace.inGlossary ?? false}
              onToggle={(next) => updatePlace(selectedPlace.id, { inGlossary: next })}
            />
          </div>
          {selectedPlace.description && (
            <p className="text-ink-300 font-serif whitespace-pre-wrap mb-4">{selectedPlace.description}</p>
          )}
          {selectedPlace.inspirations.length > 0 && (
            <div className="mb-4">
              <h4 className="font-display font-semibold text-ink-400 mb-2">Inspirations</h4>
              <ul className="list-disc list-inside text-sm text-ink-300 space-y-1">
                {selectedPlace.inspirations.map((ins, i) => <li key={i}>{ins}</li>)}
              </ul>
            </div>
          )}
          {(() => {
            // Bidirectional: show places this place is connected to + places that connect to this place
            const directIds = selectedPlace.connectedPlaceIds ?? [];
            const reverseIds = places
              .filter((p) => p.id !== selectedPlace.id && (p.connectedPlaceIds ?? []).includes(selectedPlace.id))
              .map((p) => p.id);
            const allAssociatedIds = [...new Set([...directIds, ...reverseIds])];

            return allAssociatedIds.length > 0 ? (
              <div>
                <h4 className="font-display font-semibold text-ink-400 mb-1">Lieux associés</h4>
                <p className="text-xs text-ink-200 mb-2">Lieux en relation avec celui-ci dans votre univers.</p>
                <div className="flex flex-wrap gap-2">
                  {allAssociatedIds.map((id) => {
                    const p = places.find((pl) => pl.id === id);
                    return p ? (
                      <button key={id} onClick={() => setSelectedId(id)} className="badge bg-parchment-200 text-ink-400 cursor-pointer hover:bg-parchment-300">
                        {p.name}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            ) : null;
          })()}
          {selectedPlace.notes && (
            <div className="mt-4 pt-4 border-t border-parchment-200">
              <h4 className="font-display font-semibold text-ink-400 mb-2">Notes</h4>
              <p className="text-sm text-ink-300 font-serif whitespace-pre-wrap">{selectedPlace.notes}</p>
            </div>
          )}
        </div>

        {/* Maps section */}
        {(() => {
          const placeMaps = maps.filter((m) => m.pins.some((p) => p.placeId === selectedPlace.id));
          return (
            <div className="card-fantasy p-6 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-semibold text-ink-400 flex items-center gap-2">
                  <Map className="w-5 h-5" /> Cartes
                </h4>
                <button
                  onClick={() => setShowMapLinker(true)}
                  className="btn-ghost text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  {placeMaps.length > 0 ? 'Gérer' : 'Positionner'}
                </button>
              </div>
              {placeMaps.length === 0 ? (
                <p className="text-sm text-ink-200 italic">Ce lieu n'est positionné sur aucune carte.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {placeMaps.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/maps?mapId=${m.id}`)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-parchment-100 hover:bg-parchment-200
                                 rounded-lg text-sm text-ink-400 transition-colors border border-parchment-200"
                    >
                      <img src={m.imageUrl} alt={m.name} className="w-6 h-4 object-cover rounded" />
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <ConfirmDialog
          open={!!deleteId}
          title="Supprimer le lieu"
          description="Cette action est irreversible."
          onConfirm={() => { if (deleteId) { deletePlace(deleteId); setSelectedId(null); } setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
        {showForm && <PlaceForm placeId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
        {showMapLinker && (
          <PlaceMapLinker
            placeId={selectedPlace.id}
            placeName={selectedPlace.name}
            onClose={() => setShowMapLinker(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Lieux</h2>
        <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouveau lieu</span>
        </button>
      </div>

      {places.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-200" />
          <input type="text" placeholder="Rechercher un lieu..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
        </div>
      )}

      {places.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Aucun lieu"
          description="Ajoutez les lieux, villes et villages qui composent votre univers."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Créer un lieu</button>}
        />
      ) : isSearching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} onClick={() => setSelectedId(place.id)} />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((place) => (
                <SortablePlaceCard key={place.id} place={place} onClick={() => setSelectedId(place.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showForm && <PlaceForm placeId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
    </div>
  );
}

function PlaceForm({ placeId, onClose }: { placeId: string | null; onClose: () => void }) {
  const { places, addPlace, updatePlace } = useEncyclopediaStore();

  const existing = placeId ? places.find((p) => p.id === placeId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<PlaceType>(existing?.type ?? 'other');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [inGlossary, setInGlossary] = useState(existing?.inGlossary ?? false);
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl);
  const [inspirations, setInspirations] = useState(existing?.inspirations?.join(', ') ?? '');
  const [connectedIds, setConnectedIds] = useState<string[]>(existing?.connectedPlaceIds ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const otherPlaces = places.filter((p) => p.id !== placeId);

  const isDirty = useCallback(() => {
    if (!existing) {
      return !!(name || description || imageUrl || inspirations || notes || inGlossary || connectedIds.length > 0 || type !== 'other');
    }
    return (
      name !== (existing.name ?? '') ||
      type !== (existing.type ?? 'other') ||
      description !== (existing.description ?? '') ||
      inGlossary !== (existing.inGlossary ?? false) ||
      imageUrl !== existing.imageUrl ||
      inspirations !== (existing.inspirations?.join(', ') ?? '') ||
      JSON.stringify(connectedIds) !== JSON.stringify(existing.connectedPlaceIds ?? []) ||
      notes !== (existing.notes ?? '')
    );
  }, [name, type, description, inGlossary, imageUrl, inspirations, connectedIds, notes, existing]);

  const handleSave = () => {
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      type,
      description,
      inGlossary,
      imageUrl,
      inspirations: inspirations.split(',').map((s) => s.trim()).filter(Boolean),
      connectedPlaceIds: connectedIds,
      notes,
    };

    if (existing) {
      updatePlace(existing.id, data);
    } else {
      addPlace(data);
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
          <h3 className="font-display text-xl font-bold text-ink-500">
            {existing ? 'Modifier le lieu' : 'Nouveau lieu'}
          </h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <ImageUpload value={imageUrl} onChange={setImageUrl} />

          <div>
            <label className="label-field">Nom *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
          </div>

          <div>
            <label className="label-field">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as PlaceType)} className="input-field">
              {Object.entries(PLACE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea-field" rows={3} />
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

          <div>
            <label className="label-field">Inspirations (separees par des virgules)</label>
            <input value={inspirations} onChange={(e) => setInspirations(e.target.value)} className="input-field" placeholder="Venise, Bruges, ..." />
          </div>

          <div>
            <label className="label-field">Lieux associés</label>
            <p className="text-xs text-ink-200 mb-1">Lieux en relation avec celui-ci dans votre univers.</p>
            <div className="space-y-1">
              {otherPlaces.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-ink-300">
                  <input
                    type="checkbox"
                    checked={connectedIds.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setConnectedIds([...connectedIds, p.id]);
                      else setConnectedIds(connectedIds.filter((id) => id !== p.id));
                    }}
                    className="rounded border-parchment-300"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="textarea-field" rows={2} />
          </div>
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
