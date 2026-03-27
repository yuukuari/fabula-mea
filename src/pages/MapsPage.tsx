import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Map, Trash2, Upload, X, Edit2, ArrowLeft } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { MapViewer } from '@/components/maps/MapViewer';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { MapItem } from '@/types';

function resizeImage(file: File, maxSize = 1600): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize; }
          else { w = (w / h) * maxSize; h = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function MapsPage() {
  const maps = useBookStore((s) => s.maps ?? []);
  const addMap = useBookStore((s) => s.addMap);
  const updateMap = useBookStore((s) => s.updateMap);
  const deleteMap = useBookStore((s) => s.deleteMap);

  const location = useLocation();
  const [selectedMapId, setSelectedMapId] = useState<string | null>(
    (location.state as { mapId?: string } | null)?.mapId ?? maps[0]?.id ?? null
  );
  // Historique de navigation entre cartes (drill-down / retour)
  const [mapHistory, setMapHistory] = useState<string[]>([]);

  // Quand on navigue vers /maps avec un mapId (ex: depuis un pin drill-down), on bascule sur cette carte
  useEffect(() => {
    const mapId = (location.state as { mapId?: string } | null)?.mapId;
    if (mapId && mapId !== selectedMapId) {
      if (selectedMapId) setMapHistory((h) => [...h, selectedMapId]);
      setSelectedMapId(mapId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleSelectMap = (id: string) => {
    setSelectedMapId(id);
    setMapHistory([]); // reset history when user picks manually from the list
  };

  const handleBack = () => {
    const prev = mapHistory[mapHistory.length - 1];
    if (!prev) return;
    setMapHistory((h) => h.slice(0, -1));
    setSelectedMapId(prev);
  };
  const [showNewMapDialog, setShowNewMapDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MapItem | null>(null);
  const [editingMap, setEditingMap] = useState<MapItem | null>(null);

  // New map form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageData, setNewImageData] = useState<string | null>(null);
  const [isLoadingImg, setIsLoadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const selectedMap = maps.find((m) => m.id === selectedMapId) ?? null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingImg(true);
    const data = await resizeImage(file);
    setNewImageData(data);
    if (!newName) setNewName(file.name.replace(/\.[^.]+$/, ''));
    setIsLoadingImg(false);
    e.target.value = '';
  };

  const handleCreateMap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newImageData) return;
    const id = addMap({ name: newName, description: newDescription, imageUrl: newImageData });
    setSelectedMapId(id);
    setShowNewMapDialog(false);
    setNewName(''); setNewDescription(''); setNewImageData(null);
  };

  const openEdit = (m: MapItem) => {
    setEditingMap(m);
    setEditName(m.name);
    setEditDescription(m.description ?? '');
    setShowEditDialog(true);
  };

  const handleEditMap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMap) return;
    updateMap(editingMap.id, { name: editName, description: editDescription });
    setShowEditDialog(false);
  };

  const handleDeleteMap = () => {
    if (!deleteTarget) return;
    deleteMap(deleteTarget.id);
    if (selectedMapId === deleteTarget.id) {
      setSelectedMapId(maps.find((m) => m.id !== deleteTarget.id)?.id ?? null);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel — map list */}
      <div className="w-60 flex-shrink-0 border-r border-parchment-200 bg-parchment-50 flex flex-col">
        <div className="p-4 border-b border-parchment-200 flex items-center justify-between">
          <h2 className="font-display font-bold text-ink-500">Cartes</h2>
          <button
            onClick={() => setShowNewMapDialog(true)}
            className="btn-primary w-8 h-8 p-0 flex items-center justify-center rounded-lg"
            title="Nouvelle carte"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {maps.length === 0 && (
            <p className="text-xs text-ink-200 italic text-center py-4 px-2">
              Ajoutez votre première carte
            </p>
          )}
          {maps.map((m) => (
            <div
              key={m.id}
              onClick={() => handleSelectMap(m.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectMap(m.id)}
              className={`w-full text-left rounded-lg overflow-hidden border transition-all group cursor-pointer ${
                selectedMapId === m.id
                  ? 'border-bordeaux-400 ring-1 ring-bordeaux-300'
                  : 'border-parchment-200 hover:border-parchment-400'
              }`}
            >
              <div className="aspect-video bg-parchment-200 relative">
                <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                    className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-ink-500 hover:bg-white"
                    title="Renommer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}
                    className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-red-500 hover:bg-white"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-ink-500 truncate">{m.name}</p>
                <p className="text-[10px] text-ink-200">{m.pins.length} marqueur{m.pins.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main area — map viewer */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {!selectedMap ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={Map}
              title="Aucune carte sélectionnée"
              description="Ajoutez une carte depuis le panneau de gauche pour commencer à placer vos lieux."
              action={
                <button onClick={() => setShowNewMapDialog(true)} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nouvelle carte
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2">
                {mapHistory.length > 0 && (
                  <button
                    onClick={handleBack}
                    className="btn-ghost p-1.5 mt-0.5 flex items-center gap-1 text-sm text-ink-300 hover:text-ink-500"
                    title={`Retour : ${maps.find((m) => m.id === mapHistory[mapHistory.length - 1])?.name ?? ''}`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs hidden sm:inline truncate max-w-[120px]">
                      {maps.find((m) => m.id === mapHistory[mapHistory.length - 1])?.name}
                    </span>
                  </button>
                )}
                <div>
                  <h2 className="font-display text-xl font-bold text-ink-500">{selectedMap.name}</h2>
                  {selectedMap.description && (
                    <p className="text-sm text-ink-300 mt-0.5">{selectedMap.description}</p>
                  )}
                </div>
              </div>
              <span className="text-xs text-ink-200 mt-1">
                {selectedMap.pins.length} marqueur{selectedMap.pins.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <MapViewer map={selectedMap} />
            </div>
          </>
        )}
      </div>

      {/* New map dialog */}
      {showNewMapDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewMapDialog(false)} />
          <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink-500">Nouvelle carte</h3>
              <button onClick={() => setShowNewMapDialog(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreateMap} className="space-y-4">
              {/* Image upload */}
              {newImageData ? (
                <div className="relative group">
                  <img src={newImageData} alt="" className="w-full h-40 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setNewImageData(null)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingImg}
                  className="w-full h-40 border-2 border-dashed border-parchment-300 rounded-lg
                             flex flex-col items-center justify-center gap-2 text-ink-200
                             hover:border-gold-400 hover:text-ink-300 transition-colors"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">{isLoadingImg ? 'Chargement...' : 'Importer une image de carte *'}</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

              <div>
                <label className="label-field">Nom de la carte *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-field"
                  placeholder="Ex: Carte du monde, Plan de la ville..."
                  required
                />
              </div>
              <div>
                <label className="label-field">Description (optionnel)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="textarea-field"
                  rows={2}
                  placeholder="Contexte, échelle, époque..."
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNewMapDialog(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1" disabled={!newImageData || !newName}>
                  Créer la carte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit map dialog */}
      {showEditDialog && editingMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditDialog(false)} />
          <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink-500">Modifier la carte</h3>
              <button onClick={() => setShowEditDialog(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEditMap} className="space-y-4">
              <div>
                <label className="label-field">Nom *</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="label-field">Description</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="textarea-field" rows={2} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowEditDialog(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer la carte"
        description={`Supprimer "${deleteTarget?.name}" et tous ses marqueurs ? Cette action est irréversible.`}
        onConfirm={handleDeleteMap}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
