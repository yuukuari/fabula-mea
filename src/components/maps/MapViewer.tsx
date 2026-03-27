import { useRef, useState, useCallback } from 'react';
import { Plus, X, MapPin as PinIcon, Trash2, Move, ExternalLink, ZoomIn } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useNavigate } from 'react-router-dom';
import type { MapItem, MapPin } from '@/types';
import { PLACE_TYPE_LABELS } from '@/lib/utils';

interface MapViewerProps {
  map: MapItem;
}

const PIN_COLORS = [
  '#8b2252', '#c4a35a', '#2d6a4f', '#1d3557', '#e76f51',
  '#6a4c93', '#1982c4', '#dc2626',
];

export function MapViewer({ map }: MapViewerProps) {
  const navigate = useNavigate();
  const places = useBookStore((s) => s.places);
  const allMaps = useBookStore((s) => s.maps ?? []);
  const addMapPin = useBookStore((s) => s.addMapPin);
  const updateMapPin = useBookStore((s) => s.updateMapPin);
  const deleteMapPin = useBookStore((s) => s.deleteMapPin);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [draggingPin, setDraggingPin] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  // Add pin dialog
  const [addingAt, setAddingAt] = useState<{ x: number; y: number } | null>(null);
  const [addLabel, setAddLabel] = useState('');
  const [addPlaceId, setAddPlaceId] = useState('');
  const [addColor, setAddColor] = useState(PIN_COLORS[0]);
  const [addLinkedMapId, setAddLinkedMapId] = useState('');

  // Selected pin popup
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Edit pin
  const [editingPin, setEditingPin] = useState<MapPin | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editPlaceId, setEditPlaceId] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editLinkedMapId, setEditLinkedMapId] = useState('');

  const getRelativePos = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }, []);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (draggingPin) return;
    // Only trigger if click is directly on img or container, not on a pin
    const target = e.target as HTMLElement;
    if (target.closest('[data-pin]')) return;
    const pos = getRelativePos(e);
    if (!pos) return;
    setAddingAt(pos);
    setAddLabel('');
    setAddPlaceId('');
    setAddColor(PIN_COLORS[0]);
    setAddLinkedMapId('');
    setSelectedPinId(null);
  }, [draggingPin, getRelativePos]);

  const handleAddPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingAt) return;
    if (!addLabel && !addPlaceId) return;
    const place = places.find((p) => p.id === addPlaceId);
    addMapPin(map.id, {
      x: addingAt.x,
      y: addingAt.y,
      placeId: addPlaceId || undefined,
      label: addLabel || place?.name || '',
      color: addColor,
      linkedMapId: addLinkedMapId || undefined,
    });
    setAddingAt(null);
  };

  // Drag handling
  const handlePinMouseDown = useCallback((e: React.MouseEvent, pinId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingPin(pinId);
    setSelectedPinId(null);
    const pos = getRelativePos(e);
    const pin = map.pins.find((p) => p.id === pinId);
    if (pos && pin) {
      setDragOffset({ dx: pos.x - pin.x, dy: pos.y - pin.y });
    }
  }, [getRelativePos, map.pins]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingPin) return;
    const pos = getRelativePos(e);
    if (!pos) return;
    updateMapPin(map.id, draggingPin, {
      x: Math.max(0, Math.min(100, pos.x - dragOffset.dx)),
      y: Math.max(0, Math.min(100, pos.y - dragOffset.dy)),
    });
  }, [draggingPin, dragOffset, getRelativePos, map.id, updateMapPin]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggingPin) {
      setDraggingPin(null);
    }
  }, [draggingPin]);

  const handlePinClick = useCallback((e: React.MouseEvent, pinId: string) => {
    e.stopPropagation();
    if (draggingPin) return;
    setSelectedPinId((prev) => prev === pinId ? null : pinId);
    setAddingAt(null);
  }, [draggingPin]);

  const openEditPin = (pin: MapPin) => {
    setEditingPin(pin);
    setEditLabel(pin.label ?? '');
    setEditPlaceId(pin.placeId ?? '');
    setEditColor(pin.color ?? PIN_COLORS[0]);
    setEditLinkedMapId(pin.linkedMapId ?? '');
    setSelectedPinId(null);
  };

  const handleEditPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPin) return;
    updateMapPin(map.id, editingPin.id, {
      label: editLabel,
      placeId: editPlaceId || undefined,
      color: editColor,
      linkedMapId: editLinkedMapId || undefined,
    });
    setEditingPin(null);
  };

  const selectedPin = map.pins.find((p) => p.id === selectedPinId);
  const selectedPinPlace = selectedPin?.placeId ? places.find((p) => p.id === selectedPin.placeId) : null;
  const selectedPinLinkedMap = selectedPin?.linkedMapId ? allMaps.find((m) => m.id === selectedPin.linkedMapId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Instructions */}
      <p className="text-xs text-ink-200 mb-3 flex items-center gap-1.5">
        <PinIcon className="w-3.5 h-3.5" />
        Cliquez sur la carte pour placer un lieu · Glissez un marqueur pour le déplacer · Cliquez sur un marqueur pour le détail
      </p>

      {/* Map area */}
      <div
        ref={containerRef}
        className="relative flex-1 rounded-xl overflow-hidden border border-parchment-200 bg-parchment-100 select-none"
        style={{ cursor: draggingPin ? 'grabbing' : 'crosshair', minHeight: '400px' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imgRef}
          src={map.imageUrl}
          alt={map.name}
          draggable={false}
          className="w-full h-full object-contain"
          onClick={handleImageClick}
          style={{ display: 'block', userSelect: 'none' }}
        />

        {/* Pins */}
        {map.pins.map((pin) => {
          const place = pin.placeId ? places.find((p) => p.id === pin.placeId) : null;
          const label = pin.label || place?.name || '?';
          const color = pin.color ?? '#8b2252';
          const isSelected = selectedPinId === pin.id;
          const isDragging = draggingPin === pin.id;

          const linkedMap = pin.linkedMapId ? allMaps.find((m) => m.id === pin.linkedMapId) : null;

          return (
            <div
              key={pin.id}
              data-pin="true"
              className="absolute transform -translate-x-1/2 -translate-y-full group"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                zIndex: isSelected || isDragging ? 20 : 10,
                cursor: draggingPin ? (isDragging ? 'grabbing' : 'default') : 'grab',
              }}
              onMouseDown={(e) => handlePinMouseDown(e, pin.id)}
              onClick={(e) => handlePinClick(e, pin.id)}
            >
              {/* Pin shape */}
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform relative"
                  style={{
                    backgroundColor: color,
                    transform: isSelected ? 'scale(1.3)' : isDragging ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: isSelected ? `0 0 0 3px ${color}40` : undefined,
                  }}
                >
                  {linkedMap ? (
                    <ZoomIn className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <PinIcon className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                {/* Pin stem */}
                <div className="w-0.5 h-2" style={{ backgroundColor: color }} />
              </div>

              {/* Label */}
              <div
                className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap
                           text-xs font-medium text-white px-1.5 py-0.5 rounded shadow-md pointer-events-none
                           flex items-center gap-1"
                style={{ backgroundColor: color }}
              >
                {label}
                {linkedMap && <ZoomIn className="w-2.5 h-2.5 opacity-80" />}
              </div>
            </div>
          );
        })}

        {/* Selected pin popup */}
        {selectedPin && (
          <div
            className="absolute z-30 bg-white rounded-xl shadow-xl border border-parchment-200 w-60 p-3"
            style={{
              left: `calc(${selectedPin.x}% + 20px)`,
              top: `calc(${selectedPin.y}% - 60px)`,
            }}
            data-pin="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedPin.color ?? '#8b2252' }} />
                <span className="font-display font-semibold text-sm text-ink-500">
                  {selectedPin.label || selectedPinPlace?.name || 'Marqueur'}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditPin(selectedPin)}
                  className="p-1 text-ink-200 hover:text-ink-500 hover:bg-parchment-100 rounded"
                  title="Modifier"
                >
                  <Move className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { deleteMapPin(map.id, selectedPin.id); setSelectedPinId(null); }}
                  className="p-1 text-ink-200 hover:text-red-500 hover:bg-red-50 rounded"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSelectedPinId(null)}
                  className="p-1 text-ink-200 hover:text-ink-500 hover:bg-parchment-100 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {selectedPinPlace ? (
              <div className="space-y-1">
                <span className="text-xs text-bordeaux-500 font-medium">
                  {PLACE_TYPE_LABELS[selectedPinPlace.type] ?? selectedPinPlace.type}
                </span>
                {selectedPinPlace.description && (
                  <p className="text-xs text-ink-300 line-clamp-3">{selectedPinPlace.description}</p>
                )}
                <button
                  onClick={() => navigate('/places', { state: { placeId: selectedPinPlace.id } })}
                  className="text-xs text-bordeaux-500 hover:underline mt-1 block"
                >
                  Voir la fiche lieu →
                </button>
              </div>
            ) : selectedPin.label ? (
              <p className="text-xs text-ink-300 italic">Marqueur libre (sans lieu associé)</p>
            ) : null}

            {/* Drill-down to linked map */}
            {selectedPinLinkedMap && (
              <div className="mt-2 pt-2 border-t border-parchment-100">
                <button
                  onClick={() => {
                    setSelectedPinId(null);
                    navigate('/maps', { state: { mapId: selectedPinLinkedMap.id } });
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-parchment-100 hover:bg-parchment-200
                             rounded-lg text-xs font-medium text-ink-500 transition-colors group"
                >
                  <div className="w-10 h-6 rounded overflow-hidden flex-shrink-0">
                    <img src={selectedPinLinkedMap.imageUrl} alt={selectedPinLinkedMap.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="flex-1 text-left truncate">{selectedPinLinkedMap.name}</span>
                  <ZoomIn className="w-3.5 h-3.5 text-bordeaux-500 flex-shrink-0" />
                </button>
                <p className="text-[10px] text-ink-200 mt-1 pl-1">Carte détaillée</p>
              </div>
            )}
          </div>
        )}

        {/* Add pin cursor indicator */}
        {addingAt && (
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-bordeaux-500 bg-bordeaux-200/50 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${addingAt.x}%`, top: `${addingAt.y}%` }}
          />
        )}
      </div>

      {/* Add pin dialog */}
      {addingAt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddingAt(null)} />
          <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink-500">Ajouter un marqueur</h3>
              <button onClick={() => setAddingAt(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddPin} className="space-y-3">
              <div>
                <label className="label-field">Lieu existant (optionnel)</label>
                <select value={addPlaceId} onChange={(e) => setAddPlaceId(e.target.value)} className="input-field">
                  <option value="">— Aucun lieu lié —</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Libellé{!addPlaceId && ' *'}</label>
                <input
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  className="input-field"
                  placeholder={addPlaceId ? 'Optionnel (nom du lieu par défaut)' : 'Ex: Forêt de Sylvaine'}
                  required={!addPlaceId}
                />
              </div>
              <div>
                <label className="label-field flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5" /> Carte détaillée (optionnel)
                </label>
                <select value={addLinkedMapId} onChange={(e) => setAddLinkedMapId(e.target.value)} className="input-field">
                  <option value="">— Aucune carte liée —</option>
                  {allMaps.filter((m) => m.id !== map.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {addLinkedMapId && (
                  <p className="text-[11px] text-ink-200 mt-1">
                    Cliquer sur ce marqueur permettra d'ouvrir directement cette carte.
                  </p>
                )}
              </div>
              <div>
                <label className="label-field">Couleur</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {PIN_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAddColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: addColor === c ? '#fff' : 'transparent',
                        outline: addColor === c ? `2px solid ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setAddingAt(null)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">Placer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit pin dialog */}
      {editingPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingPin(null)} />
          <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink-500">Modifier le marqueur</h3>
              <button onClick={() => setEditingPin(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEditPin} className="space-y-3">
              <div>
                <label className="label-field">Lieu lié</label>
                <select value={editPlaceId} onChange={(e) => setEditPlaceId(e.target.value)} className="input-field">
                  <option value="">— Aucun lieu lié —</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Libellé</label>
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label-field flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5" /> Carte détaillée (optionnel)
                </label>
                <select value={editLinkedMapId} onChange={(e) => setEditLinkedMapId(e.target.value)} className="input-field">
                  <option value="">— Aucune carte liée —</option>
                  {allMaps.filter((m) => m.id !== map.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {editLinkedMapId && (
                  <p className="text-[11px] text-ink-200 mt-1">
                    Cliquer sur ce marqueur permettra d'ouvrir directement cette carte.
                  </p>
                )}
              </div>
              <div>
                <label className="label-field">Couleur</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {PIN_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: editColor === c ? '#fff' : 'transparent',
                        outline: editColor === c ? `2px solid ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingPin(null)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
