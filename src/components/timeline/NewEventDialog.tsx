import { useState, useCallback } from 'react';
import { X, Plus, BookOpen } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import type { EventDuration } from '@/types';
import { cn, getChapterShortLabel } from '@/lib/utils';
import { DurationInput } from './DurationInput';

interface NewEventDialogProps {
  onClose: () => void;
  onCreate: (data: {
    title: string;
    startDate: string;
    startTime?: string;
    duration: EventDuration;
    description?: string;
    characterIds?: string[];
    placeId?: string;
    chapterId?: string;
    sceneId?: string;
  }) => void;
}

export function NewEventDialog({ onClose, onCreate }: NewEventDialogProps) {
  const { characters, places } = useEncyclopediaStore();
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [includeTime, setIncludeTime] = useState(false);
  const [startTime, setStartTime] = useState('00:00');
  const [duration, setDuration] = useState<EventDuration>({ value: 1, unit: 'days' });
  const [description, setDescription] = useState('');
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [placeId, setPlaceId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedSceneId, setSelectedSceneId] = useState('');

  const allChapters = [...chapters].sort((a, b) => a.number - b.number);

  const availableScenes = selectedChapterId
    ? scenes.filter((s) => s.chapterId === selectedChapterId)
    : [];

  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const toggleCharacter = (id: string) => {
    setCharacterIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const isDirty = useCallback(() => {
    return !!(title || description || characterIds.length > 0 || placeId || includeTime ||
      duration.value !== 1 || duration.unit !== 'days' || selectedChapterId);
  }, [title, description, characterIds, placeId, includeTime, duration, selectedChapterId]);

  const handleClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      startDate,
      startTime: includeTime ? startTime : undefined,
      duration,
      description: description.trim() || undefined,
      characterIds: characterIds.length > 0 ? characterIds : undefined,
      placeId: placeId || undefined,
      chapterId: selectedChapterId || undefined,
      sceneId: (selectedChapterId && selectedSceneId) ? selectedSceneId : undefined,
    });
  };

  const handleChapterChange = (newChapterId: string) => {
    setSelectedChapterId(newChapterId);
    setSelectedSceneId('');
  };

  const addChapter = useBookStore((s) => s.addChapter);
  const addScene = useBookStore((s) => s.addScene);

  const handleCreateChapter = () => {
    const chapterId = addChapter({ title: title.trim() || undefined, synopsis: description.trim() || undefined });
    setSelectedChapterId(chapterId);
  };

  const handleCreateScene = () => {
    if (!selectedChapterId) return;
    const sceneId = addScene({ chapterId: selectedChapterId, title: title.trim() || undefined, description: description.trim() || undefined });
    setSelectedSceneId(sceneId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h3 className="font-display text-lg font-bold text-ink-500">Nouvel événement</h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="label-field">Titre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field text-sm"
                placeholder="Ex: Arrivée à la capitale"
                autoFocus
              />
            </div>

            <div>
              <label className="label-field">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea-field text-sm"
                rows={2}
                placeholder="Description optionnelle..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Date de début *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="label-field flex items-center gap-2">
                  Heure
                  <input
                    type="checkbox"
                    checked={includeTime}
                    onChange={(e) => setIncludeTime(e.target.checked)}
                    className="rounded border-parchment-300"
                  />
                </label>
                {includeTime ? (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-field text-sm"
                  />
                ) : (
                  <div className="input-field text-sm text-ink-200 bg-parchment-100 cursor-not-allowed">—</div>
                )}
              </div>
            </div>

            <div>
              <label className="label-field">Durée *</label>
              <DurationInput value={duration} onChange={setDuration} />
            </div>

            {/* Characters */}
            {characters.length > 0 && (
              <div>
                <label className="label-field">Personnages</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {characters.map((c) => {
                    const selected = characterIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCharacter(c.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                          selected
                            ? 'bg-bordeaux-500 text-white border-bordeaux-500'
                            : 'bg-parchment-100 text-ink-300 border-parchment-300 hover:border-bordeaux-300 hover:text-ink-400'
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Place */}
            {places.length > 0 && (
              <div>
                <label className="label-field">Lieu</label>
                <select
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Aucun lieu</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Manuscript link: Chapter + Scene */}
            <div className="border-t border-parchment-200 pt-4">
              <label className="label-field flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Rattachement au manuscrit
              </label>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-ink-300 mb-1 block">Chapitre</label>
                  <div className="flex items-center gap-2">
                    {allChapters.length > 0 ? (
                      <select
                        value={selectedChapterId}
                        onChange={(e) => handleChapterChange(e.target.value)}
                        className="input-field text-sm flex-1"
                      >
                        <option value="">Aucun chapitre</option>
                        {allChapters.map((c) => (
                          <option key={c.id} value={c.id}>{getChapterShortLabel(c)}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="input-field text-sm text-ink-200 bg-parchment-100 flex-1">Aucun chapitre</div>
                    )}
                    {!selectedChapterId && (
                      <button
                        type="button"
                        onClick={handleCreateChapter}
                        className="btn-secondary text-xs flex items-center gap-1 whitespace-nowrap"
                        title="Créer un nouveau chapitre"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Chapitre
                      </button>
                    )}
                  </div>
                </div>
                {selectedChapterId && (
                  <div>
                    <label className="text-xs text-ink-300 mb-1 block">Scène (optionnel)</label>
                    <div className="flex items-center gap-2">
                      {availableScenes.length > 0 ? (
                        <select
                          value={selectedSceneId}
                          onChange={(e) => setSelectedSceneId(e.target.value)}
                          className="input-field text-sm flex-1"
                        >
                          <option value="">Aucune scène</option>
                          {availableScenes.map((s) => (
                            <option key={s.id} value={s.id}>{s.title || 'Sans titre'}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="input-field text-sm text-ink-200 bg-parchment-100 flex-1">Aucune scène dans ce chapitre</div>
                      )}
                      {!selectedSceneId && (
                        <button
                          type="button"
                          onClick={handleCreateScene}
                          className="btn-secondary text-xs flex items-center gap-1 whitespace-nowrap"
                          title="Créer une nouvelle scène dans ce chapitre"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Scène
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 p-6 pt-4 border-t border-parchment-200 flex-shrink-0">
            <button type="button" onClick={handleClose} className="btn-secondary text-sm">Annuler</button>
            <button type="submit" className="btn-primary text-sm" disabled={!title.trim()}>
              Créer
            </button>
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
              <button onClick={() => { setShowUnsavedConfirm(false); handleSave(); }} className="btn-primary text-sm" disabled={!title.trim()}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
