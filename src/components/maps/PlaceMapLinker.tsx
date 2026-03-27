import { useState, useRef, useCallback } from 'react';
import { X, MapPin as PinIcon, Check, Trash2 } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import type { MapItem } from '@/types';

interface PlaceMapLinkerProps {
  placeId: string;
  placeName: string;
  onClose: () => void;
}

const PIN_COLORS = ['#8b2252', '#c4a35a', '#2d6a4f', '#1d3557', '#e76f51', '#6a4c93', '#1982c4', '#dc2626'];

export function PlaceMapLinker({ placeId, placeName, onClose }: PlaceMapLinkerProps) {
  const maps = useBookStore((s) => s.maps ?? []);
  const addMapPin = useBookStore((s) => s.addMapPin);
  const updateMapPin = useBookStore((s) => s.updateMapPin);
  const deleteMapPin = useBookStore((s) => s.deleteMapPin);

  const [selectedMapId, setSelectedMapId] = useState<string | null>(
    // Pre-select the first map that already has this place pinned, otherwise first map
    maps.find((m) => m.pins.some((p) => p.placeId === placeId))?.id ?? maps[0]?.id ?? null
  );
  const [pinColor, setPinColor] = useState(PIN_COLORS[0]);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const selectedMap = maps.find((m) => m.id === selectedMapId);
  const existingPin = selectedMap?.pins.find((p) => p.placeId === placeId);

  // When switching map, update the color from existing pin if any
  const handleSelectMap = (map: MapItem) => {
    setSelectedMapId(map.id);
    setPendingPos(null);
    const pin = map.pins.find((p) => p.placeId === placeId);
    if (pin?.color) setPinColor(pin.color);
  };

  const getRelativePos = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const handleMapClick = (e: React.MouseEvent) => {
    const pos = getRelativePos(e);
    if (pos) setPendingPos(pos);
  };

  const handleConfirm = () => {
    if (!selectedMapId) return;
    const pos = pendingPos ?? (existingPin ? { x: existingPin.x, y: existingPin.y } : null);
    if (!pos) return;

    if (existingPin) {
      updateMapPin(selectedMapId, existingPin.id, { x: pos.x, y: pos.y, color: pinColor });
    } else {
      addMapPin(selectedMapId, { placeId, label: placeName, x: pos.x, y: pos.y, color: pinColor });
    }
    onClose();
  };

  const handleRemove = () => {
    if (!selectedMapId || !existingPin) return;
    deleteMapPin(selectedMapId, existingPin.id);
    setPendingPos(null);
  };

  const displayPin = pendingPos ?? (existingPin ? { x: existingPin.x, y: existingPin.y } : null);
  const hasChange = pendingPos !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-200">
          <div>
            <h3 className="font-display font-bold text-ink-500">Positionner sur une carte</h3>
            <p className="text-xs text-ink-300 mt-0.5">{placeName}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: map list */}
          <div className="w-44 flex-shrink-0 border-r border-parchment-200 overflow-y-auto p-2 space-y-1 bg-parchment-50">
            {maps.length === 0 && (
              <p className="text-xs text-ink-200 italic text-center py-4 px-2">Aucune carte disponible</p>
            )}
            {maps.map((m) => {
              const hasPin = m.pins.some((p) => p.placeId === placeId);
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelectMap(m)}
                  className={`w-full text-left rounded-lg overflow-hidden border transition-all ${
                    selectedMapId === m.id
                      ? 'border-bordeaux-400 ring-1 ring-bordeaux-300'
                      : 'border-parchment-200 hover:border-parchment-400'
                  }`}
                >
                  <div className="aspect-video relative">
                    <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                    {hasPin && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-bordeaux-500 rounded-full flex items-center justify-center">
                        <PinIcon className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-ink-500 truncate px-1.5 py-1">{m.name}</p>
                </button>
              );
            })}
          </div>

          {/* Right: map viewer */}
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            {!selectedMap ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-ink-200 italic">Sélectionnez une carte</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-ink-200 flex items-center gap-1">
                  <PinIcon className="w-3.5 h-3.5" />
                  {displayPin
                    ? hasChange
                      ? 'Cliquez pour repositionner le marqueur'
                      : existingPin
                        ? 'Marqueur existant — cliquez pour le déplacer'
                        : 'Position définie — confirmez ou cliquez pour ajuster'
                    : 'Cliquez sur la carte pour placer le marqueur'}
                </p>

                {/* Map image with pin */}
                <div
                  className="relative rounded-xl overflow-hidden border border-parchment-200 cursor-crosshair"
                  onClick={handleMapClick}
                >
                  <img
                    ref={imgRef}
                    src={selectedMap.imageUrl}
                    alt={selectedMap.name}
                    className="w-full object-contain select-none"
                    draggable={false}
                  />

                  {/* Show other pins on this map (grayed) */}
                  {selectedMap.pins
                    .filter((p) => p.placeId !== placeId)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none opacity-40"
                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                      >
                        <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center" style={{ backgroundColor: p.color ?? '#999' }}>
                          <PinIcon className="w-2 h-2 text-white" />
                        </div>
                        <div className="w-0.5 h-1.5 mx-auto" style={{ backgroundColor: p.color ?? '#999' }} />
                      </div>
                    ))}

                  {/* Current place pin */}
                  {displayPin && (
                    <div
                      className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none z-10"
                      style={{ left: `${displayPin.x}%`, top: `${displayPin.y}%` }}
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                        style={{ backgroundColor: pinColor }}
                      >
                        <PinIcon className="w-3 h-3 text-white" />
                      </div>
                      <div className="w-0.5 h-2 mx-auto" style={{ backgroundColor: pinColor }} />
                      {/* Label */}
                      <div
                        className="absolute bottom-full mb-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap
                                   text-[10px] font-medium text-white px-1 py-0.5 rounded shadow"
                        style={{ backgroundColor: pinColor }}
                      >
                        {placeName}
                      </div>
                    </div>
                  )}
                </div>

                {/* Color + actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1.5">
                    {PIN_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPinColor(c)}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: pinColor === c ? '#fff' : 'transparent',
                          outline: pinColor === c ? `2px solid ${c}` : 'none',
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex gap-2 ml-auto">
                    {existingPin && (
                      <button
                        onClick={handleRemove}
                        className="btn-ghost text-red-500 hover:bg-red-50 flex items-center gap-1.5 text-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Retirer de cette carte
                      </button>
                    )}
                    <button
                      onClick={handleConfirm}
                      disabled={!displayPin}
                      className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      {existingPin ? 'Mettre à jour' : 'Placer sur la carte'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
