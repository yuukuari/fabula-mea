import { useState, useCallback } from 'react';
import { Plus, BookOpen, X } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import type { TimelineEvent, EventDuration } from '@/types';
import { cn, getChapterShortLabel } from '@/lib/utils';
import { DurationInput } from './DurationInput';

interface EventEditorDialogProps {
  event: TimelineEvent;
  onClose: () => void;
}

export function EventEditorDialog({ event, onClose }: EventEditorDialogProps) {
  const { characters, places } = useEncyclopediaStore();
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const updateTimelineEvent = useBookStore((s) => s.updateTimelineEvent);
  const deleteTimelineEvent = useBookStore((s) => s.deleteTimelineEvent);
  const convertEventToChapter = useBookStore((s) => s.convertEventToChapter);
  const createSceneForEvent = useBookStore((s) => s.createSceneForEvent);

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [startDate, setStartDate] = useState(event.startDate);
  const [includeTime, setIncludeTime] = useState(!!event.startTime);
  const [startTime, setStartTime] = useState(event.startTime ?? '00:00');
  const [duration, setDuration] = useState<EventDuration>(event.duration);
  const [characterIds, setCharacterIds] = useState(event.characterIds);
  const [placeId, setPlaceId] = useState(event.placeId ?? '');
  const [selectedChapterId, setSelectedChapterId] = useState(event.chapterId ?? '');
  const [selectedSceneId, setSelectedSceneId] = useState(event.sceneId ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const allChapters = [...chapters].sort((a, b) => a.number - b.number);

  // Scenes available for linking (from selected chapter)
  const availableScenes = selectedChapterId
    ? scenes.filter((s) => s.chapterId === selectedChapterId)
    : [];

  const isDirty = useCallback(() => {
    return (
      title !== event.title ||
      description !== (event.description ?? '') ||
      startDate !== event.startDate ||
      includeTime !== !!event.startTime ||
      startTime !== (event.startTime ?? '00:00') ||
      JSON.stringify(duration) !== JSON.stringify(event.duration) ||
      JSON.stringify(characterIds) !== JSON.stringify(event.characterIds) ||
      placeId !== (event.placeId ?? '') ||
      selectedChapterId !== (event.chapterId ?? '') ||
      selectedSceneId !== (event.sceneId ?? '')
    );
  }, [title, description, startDate, includeTime, startTime, duration, characterIds, placeId, selectedChapterId, selectedSceneId, event]);

  const handleClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    updateTimelineEvent(event.id, {
      title: title.trim() || event.title,
      description: description.trim() || undefined,
      startDate,
      startTime: includeTime ? startTime : undefined,
      duration,
      characterIds,
      placeId: placeId || undefined,
      chapterId: selectedChapterId || undefined,
      sceneId: (selectedChapterId && selectedSceneId) ? selectedSceneId : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    deleteTimelineEvent(event.id);
    onClose();
  };

  const handleCreateChapter = () => {
    const chapterId = convertEventToChapter(event.id);
    if (chapterId) setSelectedChapterId(chapterId);
  };

  const handleCreateScene = () => {
    if (!selectedChapterId) return;
    const sceneId = createSceneForEvent(event.id, selectedChapterId);
    if (sceneId) setSelectedSceneId(sceneId);
  };

  const handleChapterChange = (newChapterId: string) => {
    setSelectedChapterId(newChapterId);
    if (newChapterId !== selectedChapterId) {
      setSelectedSceneId('');
    }
  };

  const toggleCharacter = (id: string) => {
    setCharacterIds((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h3 className="font-display text-lg font-bold text-ink-500">Modifier l'événement</h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Title */}
          <div>
            <label className="label-field">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label-field">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea-field text-sm"
              rows={2}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Date de début</label>
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

          {/* Duration */}
          <div>
            <label className="label-field">Durée</label>
            <DurationInput value={duration} onChange={setDuration} />
          </div>

          {/* Characters */}
          <div>
            <label className="label-field">Personnages</label>
            {characters.length > 0 ? (
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
            ) : (
              <p className="text-sm text-ink-200 italic">Aucun personnage créé</p>
            )}
          </div>

          {/* Place */}
          <div>
            <label className="label-field">Lieu</label>
            <select
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">Aucun</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Manuscript link: Chapter + Scene */}
          <div className="border-t border-parchment-200 pt-4">
            <label className="label-field flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Rattachement au manuscrit
            </label>

            <div className="space-y-3">
              {/* Chapter select */}
              <div>
                <label className="text-xs text-ink-300 mb-1 block">Chapitre</label>
                <div className="flex items-center gap-2">
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
                  {!selectedChapterId && (
                    <button
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

              {/* Scene select (only if chapter selected) */}
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

        {/* Actions */}
        <div className="flex items-center justify-between p-6 pt-4 border-t border-parchment-200 flex-shrink-0">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-bordeaux-500">Supprimer ?</span>
                <button onClick={handleDelete} className="text-sm text-bordeaux-600 font-medium hover:underline">Oui</button>
                <button onClick={() => setConfirmDelete(false)} className="text-sm text-ink-300 hover:underline">Non</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
              >
                Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} className="btn-secondary text-sm">Annuler</button>
            <button onClick={handleSave} className="btn-primary text-sm">Enregistrer</button>
          </div>
        </div>
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
