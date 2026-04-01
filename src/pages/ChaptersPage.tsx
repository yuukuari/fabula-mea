import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, ChevronDown, ChevronRight, GripVertical, Edit, Trash2, X, User, MapPin, Map, PenLine, BookText, XCircle, List } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEditorStore } from '@/store/useEditorStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS, countCharacters, countWordsFromHtml, countUnitLabel, isSpecialChapter, getChapterLabel, FRONT_MATTER_LABEL, BACK_MATTER_LABEL, WORLD_NOTE_CATEGORY_LABELS, PLACE_TYPE_LABELS } from '@/lib/utils';
import { getSceneProgress } from '@/lib/calculations';
import type { Scene, SceneStatus, Chapter, GlossaryEntry } from '@/types';

export function ChaptersPage() {
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);
  const worldNotes = useBookStore((s) => s.worldNotes);
  const maps = useBookStore((s) => s.maps ?? []);
  const writingMode = useBookStore((s) => s.writingMode);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const glossaryEnabled = useBookStore((s) => s.glossaryEnabled ?? false);
  const setGlossaryEnabled = useBookStore((s) => s.setGlossaryEnabled);
  const tableOfContents = useBookStore((s) => s.tableOfContents ?? false);
  const setTableOfContents = useBookStore((s) => s.setTableOfContents);
  const layout = useBookStore((s) => s.layout);
  const updateCharacter = useBookStore((s) => s.updateCharacter);
  const updatePlace = useBookStore((s) => s.updatePlace);
  const updateWorldNote = useBookStore((s) => s.updateWorldNote);
  const addChapter = useBookStore((s) => s.addChapter);
  const deleteChapter = useBookStore((s) => s.deleteChapter);
  const addScene = useBookStore((s) => s.addScene);
  const updateScene = useBookStore((s) => s.updateScene);
  const deleteScene = useBookStore((s) => s.deleteScene);
  const navigate = useNavigate();
  const openEditorAt = useEditorStore((s) => s.open);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [showSceneForm, setShowSceneForm] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'chapter' | 'scene'; id: string } | null>(null);

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);
  const frontMatter = sortedChapters.find(c => c.type === 'front_matter');
  const backMatter = sortedChapters.find(c => c.type === 'back_matter');
  const regularChapters = sortedChapters.filter(c => (c.type ?? 'chapter') === 'chapter');

  const renderSceneList = (chapter: Chapter) => {
    const chapterScenes = chapter.sceneIds
      .map((sid) => scenes.find((s) => s.id === sid))
      .filter(Boolean) as Scene[];
    const isExpanded = expanded[chapter.id] === true;
    const isSpecial = chapter.type === 'front_matter' || chapter.type === 'back_matter';

    if (!isExpanded) return null;

    return (
      <div className="px-4 pb-4 space-y-2">
        {chapterScenes.map((scene, sceneIdx) => {
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-ink-500 text-sm">
                      {scene.title || (isSpecial ? 'Sans titre' : `Scène ${sceneIdx + 1}`)}
                    </h4>
                    <select
                      value={scene.status}
                      onChange={(e) => updateScene(scene.id, { status: e.target.value as SceneStatus })}
                      onClick={(e) => e.stopPropagation()}
                      className={cn('text-xs px-1.5 py-0.5 rounded-full border-0 cursor-pointer font-medium', SCENE_STATUS_COLORS[scene.status])}
                    >
                      {Object.entries(SCENE_STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
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
                    <span className="text-xs text-ink-200 text-right">
                      {scene.currentWordCount}/{scene.targetWordCount} {countUnitLabel(countUnit)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  {writingMode === 'write' && (
                    <button
                      onClick={() => openEditorAt(scene.id)}
                      className="btn-ghost p-1 text-bordeaux-500 hover:text-bordeaux-700"
                      title="Écrire cette scène"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                    </button>
                  )}
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
          <Plus className="w-4 h-4" /> Ajouter une scène
        </button>
      </div>
    );
  };

  const renderSpecialSection = (chapter: Chapter | undefined) => {
    if (!chapter) return null;
    const chapterScenes = chapter.sceneIds
      .map((sid) => scenes.find((s) => s.id === sid))
      .filter(Boolean) as Scene[];
    const isExpanded = expanded[chapter.id] === true;
    const label = chapter.type === 'front_matter' ? FRONT_MATTER_LABEL : BACK_MATTER_LABEL;

    return (
      <div className="card-fantasy overflow-hidden border-dashed">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-parchment-100 transition-colors"
          onClick={() => toggleExpand(chapter.id)}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-ink-300" /> : <ChevronRight className="w-4 h-4 text-ink-300" />}
          <div className="flex-1">
            <h3 className="font-display font-bold text-ink-400 italic">{label}</h3>
            <p className="text-xs text-ink-200 mt-0.5">Dédicace, prologue, épilogue, remerciements...</p>
          </div>
          {chapterScenes.length > 0 && (
            <span className="text-xs text-ink-200">{chapterScenes.length} page{chapterScenes.length > 1 ? 's' : ''}</span>
          )}
        </div>
        {renderSceneList(chapter)}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Chapitres & Scènes</h2>
        <button onClick={() => { setEditingChapterId(null); setShowChapterForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouveau chapitre</span>
        </button>
      </div>

      <div className="space-y-3">
        {/* Table of contents section */}
        <div className="card-fantasy overflow-hidden border-dashed">
          <div className="flex items-center gap-3 p-4">
            <List className="w-4 h-4 text-ink-300 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-display font-bold text-ink-400 italic">Table des matières</h3>
              <p className="text-xs text-ink-200 mt-0.5">
                Inclure une table des matières dans les exports PDF et EPUB.
                N'apparaît pas dans le mode d'écriture.
              </p>
            </div>
            <label
              className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer flex-shrink-0"
            >
              <input
                type="checkbox"
                checked={tableOfContents}
                onChange={(e) => setTableOfContents(e.target.checked)}
                className="rounded border-parchment-300 accent-bordeaux-500"
              />
              <span className="text-xs">Activer</span>
            </label>
          </div>
        </div>

        {/* Front matter */}
        {renderSpecialSection(frontMatter)}

        {/* Regular chapters */}
        {regularChapters.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Aucun chapitre"
            description="Structurez votre histoire en chapitres, puis ajoutez des scènes à chacun."
            action={<button onClick={() => setShowChapterForm(true)} className="btn-primary">Créer un chapitre</button>}
          />
        ) : (
          regularChapters.map((chapter) => {
            const chapterScenes = chapter.sceneIds
              .map((sid) => scenes.find((s) => s.id === sid))
              .filter(Boolean) as Scene[];
            const isExpanded = expanded[chapter.id] === true;
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
                    {chapter.title && (
                      <h3 className="font-display font-bold text-ink-500">{chapter.title}</h3>
                    )}
                  </div>
                  <span className="text-xs text-ink-200">{completedScenes}/{chapterScenes.length} scènes</span>
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

                {renderSceneList(chapter)}
              </div>
            );
          })
        )}

        {/* Back matter */}
        {renderSpecialSection(backMatter)}

        {/* Glossary section */}
        {(() => {
          const glossaryEntries: GlossaryEntry[] = [
            ...characters.filter((c) => c.inGlossary).map((c) => ({
              id: c.id,
              type: 'character' as const,
              name: c.name + (c.surname ? ` ${c.surname}` : ''),
              description: c.description,
            })),
            ...places.filter((p) => p.inGlossary).map((p) => ({
              id: p.id,
              type: 'place' as const,
              name: p.name,
              description: p.description,
            })),
            ...worldNotes.filter((w) => w.inGlossary).map((w) => ({
              id: w.id,
              type: 'worldNote' as const,
              name: w.title,
              description: w.content,
            })),
          ].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

          const isGlossaryExpanded = expanded['__glossary__'] === true;

          const handleRemoveFromGlossary = (entry: GlossaryEntry) => {
            if (entry.type === 'character') updateCharacter(entry.id, { inGlossary: false });
            else if (entry.type === 'place') updatePlace(entry.id, { inGlossary: false });
            else if (entry.type === 'worldNote') updateWorldNote(entry.id, { inGlossary: false });
          };

          return (
            <div className="card-fantasy overflow-hidden border-dashed">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-parchment-100 transition-colors"
                onClick={() => toggleExpand('__glossary__')}
              >
                {isGlossaryExpanded ? <ChevronDown className="w-4 h-4 text-ink-300" /> : <ChevronRight className="w-4 h-4 text-ink-300" />}
                <div className="flex-1">
                  <h3 className="font-display font-bold text-ink-400 italic">Glossaire</h3>
                  <p className="text-xs text-ink-200 mt-0.5">
                    Fiches de personnages, lieux et univers ajoutées au glossaire.
                  </p>
                </div>
                <label
                  className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={glossaryEnabled}
                    onChange={(e) => setGlossaryEnabled(e.target.checked)}
                    className="rounded border-parchment-300 accent-bordeaux-500"
                  />
                  <span className="text-xs">Activer</span>
                </label>
              </div>

              {isGlossaryExpanded && (
                <div className="px-4 pb-4">
                  {!glossaryEnabled && (
                    <p className="text-xs text-ink-200 italic mb-2">
                      Le glossaire est désactivé. Activez-le pour l'inclure dans votre livre.
                    </p>
                  )}

                  {glossaryEnabled && glossaryEntries.length === 0 ? (
                    <p className="text-xs text-ink-200 italic py-2">
                      Aucune fiche n'a été ajoutée au glossaire. Cochez « Inclure dans le glossaire » sur les fiches de personnages, lieux ou univers.
                    </p>
                  ) : glossaryEntries.length > 0 ? (
                    <div className="space-y-1.5">
                      {glossaryEntries.map((entry) => (
                        <div
                          key={`${entry.type}-${entry.id}`}
                          className="flex items-center gap-3 bg-parchment-100 rounded-lg px-3 py-2 group"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-ink-500 truncate block">{entry.name}</span>
                            {entry.description && (
                              <p className="text-xs text-ink-200 mt-0.5 line-clamp-1">{entry.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveFromGlossary(entry)}
                            className="btn-ghost p-1 text-ink-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            title="Retirer du glossaire"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })()}

        {/* 4ème de couverture */}
        {layout?.coverBack && (
          <div className="card-fantasy overflow-hidden border-dashed">
            <div className="p-6 text-center">
              <img src={layout.coverBack} alt="4ème de couverture" className="max-h-64 mx-auto rounded-lg shadow-sm" />
              <p className="text-xs text-ink-200 mt-2">4ème de couverture</p>
            </div>
          </div>
        )}
      </div>

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
            <label className="label-field">Titre <span className="text-ink-200 font-normal">(facultatif)</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Laisser vide pour afficher uniquement le numéro" />
          </div>
          <div>
            <label className="label-field">Synopsis</label>
            <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} className="textarea-field" rows={3} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Créer'}</button>
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
  const writingMode = useBookStore((s) => s.writingMode);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
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
            <label className="label-field">Titre <span className="text-ink-200 font-normal">(facultatif)</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Laisser vide pour afficher Scène N" />
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
              <label className="label-field">Objectif {countUnitLabel(countUnit)}</label>
              <input type="number" value={targetWordCount} onChange={(e) => setTargetWordCount(Number(e.target.value))} className="input-field" min={0} />
            </div>
            {writingMode === 'count' && (
              <div>
                <label className="label-field">{countUnit === 'characters' ? 'Signes écrits' : 'Mots écrits'}</label>
                <input type="number" value={currentWordCount} onChange={(e) => setCurrentWordCount(Number(e.target.value))} className="input-field" min={0} />
              </div>
            )}
            {writingMode === 'write' && (
              <div>
                <label className="label-field">{countUnit === 'characters' ? 'Signes écrits' : 'Mots écrits'}</label>
                <p className="input-field bg-parchment-100 text-ink-300 cursor-not-allowed select-none">
                  {currentWordCount} <span className="text-xs">(calculé automatiquement)</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-parchment-300">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{scene ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
