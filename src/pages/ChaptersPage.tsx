import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, ChevronDown, ChevronRight, GripVertical, Edit, Trash2, X, User, MapPin, Map } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS } from '@/lib/utils';
import { getSceneProgress } from '@/lib/calculations';
import type { Scene, SceneStatus } from '@/types';

export function ChaptersPage() {
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);
  const maps = useBookStore((s) => s.maps ?? []);
  const addChapter = useBookStore((s) => s.addChapter);
  const deleteChapter = useBookStore((s) => s.deleteChapter);
  const addScene = useBookStore((s) => s.addScene);
  const updateScene = useBookStore((s) => s.updateScene);
  const deleteScene = useBookStore((s) => s.deleteScene);
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [showSceneForm, setShowSceneForm] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'chapter' | 'scene'; id: string } | null>(null);

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Chapitres & Scenes</h2>
        <button onClick={() => { setEditingChapterId(null); setShowChapterForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouveau chapitre</span>
        </button>
      </div>

      {chapters.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun chapitre"
          description="Structurez votre histoire en chapitres, puis ajoutez des scenes a chacun."
          action={<button onClick={() => setShowChapterForm(true)} className="btn-primary">Creer un chapitre</button>}
        />
      ) : (
        <div className="space-y-3">
          {sortedChapters.map((chapter) => {
            const chapterScenes = chapter.sceneIds
              .map((sid) => scenes.find((s) => s.id === sid))
              .filter(Boolean) as Scene[];
            const isExpanded = expanded[chapter.id] !== false;
            const completedScenes = chapterScenes.filter((s) => getSceneProgress(s) >= 1).length;

            return (
              <div key={chapter.id} className="card-fantasy overflow-hidden">
                {/* Chapter Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-parchment-100 transition-colors"
                  onClick={() => toggleExpand(chapter.id)}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: chapter.color }} />
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-ink-300" /> : <ChevronRight className="w-4 h-4 text-ink-300" />}
                  <div className="flex-1">
                    <span className="text-xs text-ink-200 font-medium">Chapitre {chapter.number}</span>
                    <h3 className="font-display font-bold text-ink-500">{chapter.title}</h3>
                  </div>
                  <span className="text-xs text-ink-200">{completedScenes}/{chapterScenes.length} scenes</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingChapterId(chapter.id); setShowChapterForm(true); }}
                    className="btn-ghost p-1"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'chapter', id: chapter.id }); }}
                    className="btn-ghost p-1 text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {chapter.synopsis && isExpanded && (
                  <p className="px-4 pb-2 text-sm text-ink-300 italic">{chapter.synopsis}</p>
                )}

                {/* Scenes */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {chapterScenes.map((scene) => {
                      const progress = getSceneProgress(scene);
                      const sceneChars = scene.characterIds
                        .map((cid) => characters.find((c) => c.id === cid))
                        .filter(Boolean);
                      const scenePlace = scene.placeId ? places.find((p) => p.id === scene.placeId) : null;
                      const sceneMaps = scenePlace
                        ? maps.filter((m) => m.pins.some((p) => p.placeId === scenePlace.id))
                        : [];

                      return (
                        <div key={scene.id} className="bg-parchment-100 rounded-lg p-3 group">
                          <div className="flex items-start gap-3">
                            <GripVertical className="w-4 h-4 text-ink-100 mt-1 opacity-0 group-hover:opacity-100 cursor-grab" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-ink-500 text-sm">{scene.title}</h4>
                                <span className={cn('badge text-xs', SCENE_STATUS_COLORS[scene.status])}>
                                  {SCENE_STATUS_LABELS[scene.status]}
                                </span>
                              </div>
                              {scene.description && (
                                <p className="text-xs text-ink-300 mt-1 line-clamp-2">{scene.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-ink-200">
                                {sceneChars.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {sceneChars.map((c) => c!.name).join(', ')}
                                  </span>
                                )}
                                {scenePlace && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {scenePlace.name}
                                    {sceneMaps.map((m) => (
                                      <button
                                        key={m.id}
                                        onClick={(e) => { e.stopPropagation(); navigate('/maps', { state: { mapId: m.id } }); }}
                                        title={`Voir sur la carte : ${m.name}`}
                                        className="ml-0.5 text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
                                      >
                                        <Map className="w-3 h-3" />
                                      </button>
                                    ))}
                                  </span>
                                )}
                                {scene.startDateTime && (
                                  <span>{new Date(scene.startDateTime).toLocaleDateString('fr-FR')}</span>
                                )}
                              </div>
                              {/* Progress bar */}
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-parchment-300 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      progress >= 1 ? 'bg-green-500' : progress > 0.5 ? 'bg-gold-400' : 'bg-bordeaux-400'
                                    )}
                                    style={{ width: `${progress * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-ink-200 w-16 text-right">
                                  {scene.currentWordCount}/{scene.targetWordCount}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                              <button onClick={() => setEditingScene(scene)} className="btn-ghost p-1">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteTarget({ type: 'scene', id: scene.id })} className="btn-ghost p-1 text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => setShowSceneForm(chapter.id)}
                      className="w-full py-2 text-sm text-ink-200 border border-dashed border-parchment-300 rounded-lg
                                 hover:border-gold-400 hover:text-ink-300 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Ajouter une scene
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showChapterForm && (
        <ChapterFormDialog
          chapterId={editingChapterId}
          onClose={() => { setShowChapterForm(false); setEditingChapterId(null); }}
        />
      )}

      {(showSceneForm || editingScene) && (
        <SceneFormDialog
          chapterId={showSceneForm ?? editingScene!.chapterId}
          scene={editingScene}
          onClose={() => { setShowSceneForm(null); setEditingScene(null); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'chapter' ? 'Supprimer le chapitre' : 'Supprimer la scene'}
        description={deleteTarget?.type === 'chapter'
          ? 'Le chapitre et toutes ses scenes seront supprimes.'
          : 'Cette scene sera supprimee definitivement.'}
        onConfirm={() => {
          if (deleteTarget?.type === 'chapter') deleteChapter(deleteTarget.id);
          else if (deleteTarget?.type === 'scene') deleteScene(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ChapterFormDialog({ chapterId, onClose }: { chapterId: string | null; onClose: () => void }) {
  const chapters = useBookStore((s) => s.chapters);
  const addChapter = useBookStore((s) => s.addChapter);
  const updateChapter = useBookStore((s) => s.updateChapter);
  const existing = chapterId ? chapters.find((c) => c.id === chapterId) : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [synopsis, setSynopsis] = useState(existing?.synopsis ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (existing) {
      updateChapter(existing.id, { title, synopsis });
    } else {
      addChapter({ title, synopsis });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">
            {existing ? 'Modifier le chapitre' : 'Nouveau chapitre'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="label-field">Synopsis</label>
            <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} className="textarea-field" rows={3} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SceneFormDialog({ chapterId, scene, onClose }: { chapterId: string; scene: Scene | null; onClose: () => void }) {
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);
  const goals = useBookStore((s) => s.goals);
  const addScene = useBookStore((s) => s.addScene);
  const updateScene = useBookStore((s) => s.updateScene);

  const [title, setTitle] = useState(scene?.title ?? '');
  const [description, setDescription] = useState(scene?.description ?? '');
  const [characterIds, setCharacterIds] = useState<string[]>(scene?.characterIds ?? []);
  const [placeId, setPlaceId] = useState(scene?.placeId ?? '');
  const [startDateTime, setStartDateTime] = useState(scene?.startDateTime ?? '');
  const [endDateTime, setEndDateTime] = useState(scene?.endDateTime ?? '');
  const [targetWordCount, setTargetWordCount] = useState(scene?.targetWordCount ?? goals.defaultWordsPerScene);
  const [currentWordCount, setCurrentWordCount] = useState(scene?.currentWordCount ?? 0);
  const [status, setStatus] = useState<SceneStatus>(scene?.status ?? 'outline');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data = {
      title: title.trim(),
      description,
      characterIds,
      placeId: placeId || undefined,
      startDateTime: startDateTime || undefined,
      endDateTime: endDateTime || undefined,
      targetWordCount,
      currentWordCount,
      status,
    };

    if (scene) {
      updateScene(scene.id, data);
    } else {
      addScene({ ...data, chapterId });
    }
    onClose();
  };

  const toggleCharacter = (id: string) => {
    setCharacterIds((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 my-4">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300">
          <h3 className="font-display text-xl font-bold text-ink-500">
            {scene ? 'Modifier la scene' : 'Nouvelle scene'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label-field">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" required />
          </div>

          <div>
            <label className="label-field">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea-field" rows={3} />
          </div>

          <div>
            <label className="label-field">Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as SceneStatus)} className="input-field">
              {Object.entries(SCENE_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">Personnages presents</label>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
              {characters.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-ink-300 py-1">
                  <input
                    type="checkbox"
                    checked={characterIds.includes(c.id)}
                    onChange={() => toggleCharacter(c.id)}
                    className="rounded border-parchment-300"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Lieu</label>
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="input-field">
              <option value="">Aucun</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Date/heure debut (dans l'histoire)</label>
              <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-field">Date/heure fin</label>
              <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Objectif mots</label>
              <input type="number" value={targetWordCount} onChange={(e) => setTargetWordCount(Number(e.target.value))} className="input-field" min={0} />
            </div>
            <div>
              <label className="label-field">Mots actuels</label>
              <input type="number" value={currentWordCount} onChange={(e) => setCurrentWordCount(Number(e.target.value))} className="input-field" min={0} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-parchment-300">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{scene ? 'Enregistrer' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
