import { useState } from 'react';
import { Plus, BookOpen, X } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import type { EventDuration } from '@/types';
import { cn, getChapterShortLabel } from '@/lib/utils';
import { DurationInput } from './DurationInput';

interface InsertEventDialogProps {
  refId: string;
  position: 'before' | 'after';
  onClose: () => void;
}

export function InsertEventDialog({ refId, position, onClose }: InsertEventDialogProps) {
  const { characters, places } = useEncyclopediaStore();
  const insertTimelineEvent = useBookStore((s) => s.insertTimelineEvent);
  const refEvent = (useBookStore((s) => s.timelineEvents) ?? []).find((e) => e.id === refId);

  const [title, setTitle] = useState(refEvent?.title ?? 'Nouvel événement');
  const [description, setDescription] = useState(refEvent?.description ?? '');
  const [duration, setDuration] = useState<EventDuration>({ value: 1, unit: refEvent?.duration.unit ?? 'days' });
  const [characterIds, setCharacterIds] = useState(refEvent?.characterIds ?? []);
  const [placeId, setPlaceId] = useState(refEvent?.placeId ?? '');

  if (!refEvent) { onClose(); return null; }

  const toggleCharacter = (id: string) => {
    setCharacterIds((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  };

  const handleCreate = () => {
    insertTimelineEvent(refId, position, {
      title: title.trim() || 'Nouvel événement',
      description: description.trim() || undefined,
      duration,
      characterIds,
      placeId: placeId || undefined,
      chapterId: refEvent.chapterId, // copied, no scene
    });
    onClose();
  };

  const label = position === 'before' ? 'avant' : 'après';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">
            Insérer {label} « {refEvent.title} »
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label-field">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-sm"
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
            />
          </div>

          <div>
            <label className="label-field">Durée</label>
            <DurationInput value={duration} onChange={setDuration} />
            <p className="text-xs text-ink-200 mt-1">
              {position === 'after'
                ? `Cet événement commencera juste après « ${refEvent.title} ».`
                : `Cet événement se terminera juste avant « ${refEvent.title} ».`
              }
            </p>
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
                <option value="">Aucun</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Chapter info (read-only) */}
          {refEvent.chapterId && (() => {
            const chapters = useBookStore.getState().chapters;
            const ch = chapters.find((c) => c.id === refEvent.chapterId);
            return ch ? (
              <div className="text-xs text-ink-200 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Chapitre : <span className="font-medium" style={{ color: ch.color }}>{getChapterShortLabel(ch)}</span>
              </div>
            ) : null;
          })()}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            <button onClick={handleCreate} className="btn-primary text-sm">
              <Plus className="w-4 h-4 mr-1" />
              Insérer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
