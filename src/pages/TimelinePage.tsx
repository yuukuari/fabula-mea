import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Edit, X, User, MapPin, Map } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Scene, SceneStatus } from '@/types';
import { SCENE_STATUS_LABELS } from '@/lib/utils';

export function TimelinePage() {
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);
  const maps = useBookStore((s) => s.maps ?? []);
  const updateScene = useBookStore((s) => s.updateScene);

  const [highlightChapterId, setHighlightChapterId] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  // Only scenes with dates can be shown on the timeline
  const datedScenes = useMemo(() =>
    scenes.filter((s) => s.startDateTime),
    [scenes]
  );

  // Get time range
  const timeRange = useMemo(() => {
    if (datedScenes.length === 0) return null;
    const starts = datedScenes.map((s) => new Date(s.startDateTime!).getTime());
    const ends = datedScenes.map((s) => s.endDateTime ? new Date(s.endDateTime).getTime() : new Date(s.startDateTime!).getTime() + 3600000);
    return {
      min: Math.min(...starts),
      max: Math.max(...ends),
    };
  }, [datedScenes]);

  // Characters that appear in dated scenes
  const timelineCharacters = useMemo(() => {
    const charIds = new Set(datedScenes.flatMap((s) => s.characterIds));
    return characters.filter((c) => charIds.has(c.id));
  }, [datedScenes, characters]);

  if (datedScenes.length === 0) {
    return (
      <div className="page-container">
        <h2 className="section-title mb-6">Chronologie</h2>
        <EmptyState
          icon={Clock}
          title="Pas de scenes datees"
          description="Ajoutez des dates de debut aux scenes dans l'onglet Chapitres pour les voir apparaitre dans la chronologie."
        />
      </div>
    );
  }

  const totalDuration = timeRange!.max - timeRange!.min || 1;

  const getPosition = (dateStr: string) => {
    return ((new Date(dateStr).getTime() - timeRange!.min) / totalDuration) * 100;
  };

  const getWidth = (scene: Scene) => {
    const start = new Date(scene.startDateTime!).getTime();
    const end = scene.endDateTime ? new Date(scene.endDateTime).getTime() : start + 3600000;
    return Math.max(((end - start) / totalDuration) * 100, 2);
  };

  const getChapterColor = (chapterId: string) => {
    const ch = chapters.find((c) => c.id === chapterId);
    return ch?.color ?? '#999';
  };

  const formatTimeLabel = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Build time axis labels
  const timeLabels = useMemo(() => {
    const labels: { position: number; label: string }[] = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = timeRange!.min + (totalDuration * i) / steps;
      labels.push({ position: (i / steps) * 100, label: formatTimeLabel(t) });
    }
    return labels;
  }, [timeRange, totalDuration]);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Chronologie</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-ink-300">Chapitre :</label>
          <select
            value={highlightChapterId ?? ''}
            onChange={(e) => setHighlightChapterId(e.target.value || null)}
            className="input-field w-48 text-sm py-1"
          >
            <option value="">Tous</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Ch. {c.number} - {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {chapters.map((ch) => (
          <div key={ch.id} className="flex items-center gap-1.5 text-xs text-ink-300">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: ch.color }} />
            Ch. {ch.number}
          </div>
        ))}
      </div>

      {/* Timeline Grid */}
      <div className="card-fantasy p-6 overflow-x-auto">
        {/* Time axis */}
        <div className="relative h-8 mb-2 ml-32">
          {timeLabels.map((tl, i) => (
            <span
              key={i}
              className="absolute text-xs text-ink-200 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${tl.position}%` }}
            >
              {tl.label}
            </span>
          ))}
        </div>

        {/* Character rows */}
        <div className="space-y-1">
          {timelineCharacters.map((char) => {
            const charScenes = datedScenes.filter((s) => s.characterIds.includes(char.id));

            return (
              <div key={char.id} className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0 text-right">
                  <span className="text-sm font-medium text-ink-400 truncate block">{char.name}</span>
                </div>
                <div className="flex-1 relative h-10 bg-parchment-100 rounded">
                  {charScenes.map((scene) => {
                    const left = getPosition(scene.startDateTime!);
                    const width = getWidth(scene);
                    const isHighlighted = !highlightChapterId || scene.chapterId === highlightChapterId;
                    const chapter = chapters.find((c) => c.id === scene.chapterId);
                    const place = scene.placeId ? places.find((p) => p.id === scene.placeId) : null;
                    const sceneMaps = place
                      ? maps.filter((m) => m.pins.some((p) => p.placeId === place.id))
                      : [];

                    return (
                      <div
                        key={scene.id}
                        className="absolute top-1 bottom-1 rounded cursor-pointer transition-all group"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          minWidth: '24px',
                          backgroundColor: getChapterColor(scene.chapterId),
                          opacity: isHighlighted ? 1 : 0.2,
                        }}
                        onClick={() => setEditingScene(scene)}
                        title={scene.title}
                      >
                        <span className="text-[10px] text-white px-1 truncate block leading-8 font-medium">
                          {scene.title}
                        </span>
                        {/* Small map indicator on block */}
                        {sceneMaps.length > 0 && (
                          <div className="absolute top-0.5 right-0.5 w-3 h-3 opacity-70">
                            <Map className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-0 mb-1 bg-ink-500 text-white text-xs rounded-lg p-2 hidden group-hover:block z-10 whitespace-nowrap shadow-lg">
                          <div className="font-medium">{scene.title}</div>
                          {chapter && <div className="text-white/70">Ch. {chapter.number} - {chapter.title}</div>}
                          {place && (
                            <div className="text-white/70 flex items-center gap-1 flex-wrap">
                              <MapPin className="w-3 h-3" />{place.name}
                              {sceneMaps.map((m) => (
                                <span key={m.id} className="flex items-center gap-0.5 text-gold-300">
                                  <Map className="w-3 h-3" />{m.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-white/70">{new Date(scene.startDateTime!).toLocaleString('fr-FR')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Edit Dialog */}
      {editingScene && (
        <TimelineSceneEditor
          scene={editingScene}
          onClose={() => setEditingScene(null)}
        />
      )}
    </div>
  );
}

function TimelineSceneEditor({ scene, onClose }: { scene: Scene; onClose: () => void }) {
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);
  const maps = useBookStore((s) => s.maps ?? []);
  const updateScene = useBookStore((s) => s.updateScene);
  const navigate = useNavigate();

  const [startDateTime, setStartDateTime] = useState(scene.startDateTime ?? '');
  const [endDateTime, setEndDateTime] = useState(scene.endDateTime ?? '');
  const [characterIds, setCharacterIds] = useState(scene.characterIds);
  const [placeId, setPlaceId] = useState(scene.placeId ?? '');

  const handleSave = () => {
    updateScene(scene.id, {
      startDateTime: startDateTime || undefined,
      endDateTime: endDateTime || undefined,
      characterIds,
      placeId: placeId || undefined,
    });
    onClose();
  };

  const toggleCharacter = (id: string) => {
    setCharacterIds((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">{scene.title}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Debut</label>
              <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="label-field">Fin</label>
              <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} className="input-field text-sm" />
            </div>
          </div>

          <div>
            <label className="label-field">Personnages</label>
            <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
              {characters.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-ink-300 py-0.5">
                  <input type="checkbox" checked={characterIds.includes(c.id)} onChange={() => toggleCharacter(c.id)} className="rounded border-parchment-300" />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Lieu</label>
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="input-field text-sm">
              <option value="">Aucun</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {/* Map links for selected place */}
            {placeId && (() => {
              const linkedMaps = maps.filter((m) => m.pins.some((p) => p.placeId === placeId));
              if (linkedMaps.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {linkedMaps.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { onClose(); navigate('/maps', { state: { mapId: m.id } }); }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-parchment-100 hover:bg-parchment-200
                                 rounded text-xs text-ink-400 transition-colors border border-parchment-200"
                    >
                      <img src={m.imageUrl} alt={m.name} className="w-5 h-3.5 object-cover rounded" />
                      <Map className="w-3 h-3 text-bordeaux-400" />
                      {m.name}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            <button onClick={handleSave} className="btn-primary text-sm">Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
