import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, MapPin, Search, Edit, Trash2, ArrowLeft, X, Map } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PlaceMapLinker } from '@/components/maps/PlaceMapLinker';
import { PLACE_TYPE_LABELS } from '@/lib/utils';
import type { Place, PlaceType } from '@/types';

export function PlacesPage() {
  const places = useBookStore((s) => s.places);
  const maps = useBookStore((s) => s.maps ?? []);
  const addPlace = useBookStore((s) => s.addPlace);
  const updatePlace = useBookStore((s) => s.updatePlace);
  const deletePlace = useBookStore((s) => s.deletePlace);
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

  const filtered = places.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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
            <img src={selectedPlace.imageUrl} alt={selectedPlace.name} className="w-full h-64 object-cover rounded-lg mb-4" />
          )}
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-display text-3xl font-bold text-ink-500">{selectedPlace.name}</h2>
            <span className="badge bg-parchment-200 text-ink-400">{PLACE_TYPE_LABELS[selectedPlace.type]}</span>
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
          {selectedPlace.connectedPlaceIds.length > 0 && (
            <div>
              <h4 className="font-display font-semibold text-ink-400 mb-2">Lieux connectes</h4>
              <div className="flex flex-wrap gap-2">
                {selectedPlace.connectedPlaceIds.map((id) => {
                  const p = places.find((pl) => pl.id === id);
                  return p ? (
                    <button key={id} onClick={() => setSelectedId(id)} className="badge bg-parchment-200 text-ink-400 cursor-pointer hover:bg-parchment-300">
                      {p.name}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          )}
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
                      onClick={() => navigate('/maps', { state: { mapId: m.id } })}
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
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Creer un lieu</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((place) => (
            <div key={place.id} onClick={() => setSelectedId(place.id)} className="card-fantasy cursor-pointer overflow-hidden">
              {place.imageUrl ? (
                <img src={place.imageUrl} alt={place.name} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-parchment-200 flex items-center justify-center">
                  <MapPin className="w-12 h-12 text-ink-100" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-ink-500">{place.name}</h3>
                  <span className="badge bg-parchment-200 text-ink-300 text-xs">{PLACE_TYPE_LABELS[place.type]}</span>
                </div>
                {place.description && (
                  <p className="text-sm text-ink-300 mt-1 line-clamp-2">{place.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <PlaceForm placeId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
    </div>
  );
}

function PlaceForm({ placeId, onClose }: { placeId: string | null; onClose: () => void }) {
  const places = useBookStore((s) => s.places);
  const addPlace = useBookStore((s) => s.addPlace);
  const updatePlace = useBookStore((s) => s.updatePlace);

  const existing = placeId ? places.find((p) => p.id === placeId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<PlaceType>(existing?.type ?? 'other');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl);
  const [inspirations, setInspirations] = useState(existing?.inspirations?.join(', ') ?? '');
  const [connectedIds, setConnectedIds] = useState<string[]>(existing?.connectedPlaceIds ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const otherPlaces = places.filter((p) => p.id !== placeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      type,
      description,
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 my-4">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300">
          <h3 className="font-display text-xl font-bold text-ink-500">
            {existing ? 'Modifier le lieu' : 'Nouveau lieu'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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

          <div>
            <label className="label-field">Inspirations (separees par des virgules)</label>
            <input value={inspirations} onChange={(e) => setInspirations(e.target.value)} className="input-field" placeholder="Venise, Bruges, ..." />
          </div>

          <div>
            <label className="label-field">Lieux connectes</label>
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

          <div className="flex justify-end gap-3 pt-4 border-t border-parchment-300">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
