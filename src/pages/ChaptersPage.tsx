import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, ChevronDown, ChevronRight, GripVertical, Edit, Trash2, X, User, MapPin, Map, PenLine, BookText, XCircle, List, Globe, ExternalLink, CalendarDays } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { useEditorStore } from '@/store/useEditorStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS, countUnitLabel, isSpecialChapter, getChapterLabel, FRONT_MATTER_LABEL, BACK_MATTER_LABEL, WORLD_NOTE_CATEGORY_LABELS, PLACE_TYPE_LABELS, formatDuration } from '@/lib/utils';
import { getSceneProgress, getSceneTarget } from '@/lib/calculations';
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Scene, SceneStatus, Chapter, GlossaryEntry, EventDuration, DurationUnit, TimelineEvent, Character, Place, MapItem, MapPin as MapPinType } from '@/types';

interface SortableSceneItemProps {
  scene: Scene;
  sceneIdx: number;
  isSpecial: boolean;
  characters: Character[];
  places: Place[];
  maps: MapItem[];
  writingMode: 'count' | 'write';
  countUnit: 'words' | 'characters';
  goals: ReturnType<typeof useBookStore.getState>['goals'];
  scenes: Scene[];
  timelineEvents: TimelineEvent[];
  onNavigate: (path: string, options?: { state?: Record<string, unknown> }) => void;
  onOpenEditor: (sceneId: string) => void;
  onUpdateScene: (sceneId: string, data: Partial<Scene>) => void;
  onEditScene: (scene: Scene) => void;
  onDeleteScene: (sceneId: string) => void;
  onShowEvents: (title: string, events: TimelineEvent[]) => void;
}

function SortableSceneItem({
  scene,
  sceneIdx,
  isSpecial,
  characters,
  places,
  maps,
  writingMode,
  countUnit,
  goals,
  scenes,
  timelineEvents,
  onNavigate,
  onOpenEditor,
  onUpdateScene,
  onEditScene,
  onDeleteScene,
  onShowEvents,
}: SortableSceneItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const progress = getSceneProgress(scene, scenes, goals);
  const sceneTarget = getSceneTarget(scene, scenes, goals);
  const sceneChars = scene.characterIds
    .map((cid) => characters.find((c) => c.id === cid))
    .filter(Boolean);
  const scenePlace = scene.placeId ? places.find((p) => p.id === scene.placeId) : null;
  const sceneMaps = scenePlace
    ? maps.filter((m) => m.pins.some((p: MapPinType) => p.placeId === scenePlace.id))
    : [];

  return (
    <div ref={setNodeRef} style={style} className="bg-parchment-100 rounded-lg p-3 group">
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 mt-0.5 rounded text-ink-100 hover:text-ink-400 hover:bg-parchment-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-ink-500 text-sm">
              {scene.title || (isSpecial ? 'Sans titre' : `Scène ${sceneIdx + 1}`)}
            </h4>
            <select
              value={scene.status}
              onChange={(e) => onUpdateScene(scene.id, { status: e.target.value as SceneStatus })}
              onClick={(e) => e.stopPropagation()}
              className={cn('text-xs px-1.5 py-0.5 rounded-full border-0 cursor-pointer font-medium', SCENE_STATUS_COLORS[scene.status])}
            >
              {Object.entries(SCENE_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {scene.description && (
            <p className="text-xs text-ink-300 mt-1 line-clamp-2 whitespace-pre-line">{scene.description}</p>
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
                    onClick={(e) => { e.stopPropagation(); onNavigate('/maps', { state: { mapId: m.id } }); }}
                    title={`Voir sur la carte : ${m.name}`}
                    className="ml-0.5 text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
                  >
                    <Map className="w-3 h-3" />
                  </button>
                ))}
              </span>
            )}
            {scene.startDate && (
              <span>{new Date(scene.startDate + 'T00:00:00').toLocaleDateString('fr-FR')}</span>
            )}
            {(() => {
              const sceneEvents = timelineEvents.filter((e) => e.sceneId === scene.id);
              if (sceneEvents.length === 0) return null;
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowEvents(
                      scene.title || (isSpecial ? 'Sans titre' : `Scène ${sceneIdx + 1}`),
                      sceneEvents
                    );
                  }}
                  className="flex items-center gap-1 text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
                  title={`${sceneEvents.length} événement${sceneEvents.length > 1 ? 's' : ''}`}
                >
                  <CalendarDays className="w-3 h-3" />
                  {sceneEvents.length}
                </button>
              );
            })()}
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
              {sceneTarget != null
                ? `${scene.currentWordCount}/${sceneTarget} ${countUnitLabel(countUnit)}`
                : `${scene.currentWordCount} ${countUnitLabel(countUnit)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {writingMode === 'write' && (
            <button
              onClick={() => onOpenEditor(scene.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white bg-bordeaux-500 hover:bg-bordeaux-600 transition-colors"
              title="Écrire cette scène"
            >
              <PenLine className="w-3 h-3" />
              Écrire
            </button>
          )}
          <button onClick={() => onEditScene(scene)} className="btn-ghost p-1">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDeleteScene(scene.id)} className="btn-ghost p-1 text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Droppable zone for each chapter's scene list
function DroppableSceneList({ chapterId, children }: { chapterId: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `chapter-drop-${chapterId}` });

  return (
    <div
      ref={setNodeRef}
      className="px-4 pb-4 space-y-2 mt-4"
    >
      {children}
    </div>
  );
}

// Droppable wrapper for entire chapter (header + scene list)
function DroppableChapter({ chapterId, children }: { chapterId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `chapter-header-${chapterId}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all rounded-lg',
        isOver && 'ring-2 ring-gold-400 ring-offset-2 ring-offset-parchment-50'
      )}
    >
      {children}
    </div>
  );
}

export function ChaptersPage() {
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const { characters, places, worldNotes, maps: rawMaps, updateCharacter, updatePlace, updateWorldNote } = useEncyclopediaStore();
  const maps = rawMaps ?? [];
  const writingMode = useBookStore((s) => s.writingMode);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const glossaryEnabled = useBookStore((s) => s.glossaryEnabled ?? false);
  const setGlossaryEnabled = useBookStore((s) => s.setGlossaryEnabled);
  const tableOfContents = useBookStore((s) => s.tableOfContents ?? false);
  const setTableOfContents = useBookStore((s) => s.setTableOfContents);
  const layout = useBookStore((s) => s.layout);
  const addChapter = useBookStore((s) => s.addChapter);
  const deleteChapter = useBookStore((s) => s.deleteChapter);
  const addScene = useBookStore((s) => s.addScene);
  const updateScene = useBookStore((s) => s.updateScene);
  const deleteScene = useBookStore((s) => s.deleteScene);
  const reorderScenes = useBookStore((s) => s.reorderScenes);
  const moveScene = useBookStore((s) => s.moveScene);
  const navigate = useNavigate();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  // Virtual scene arrangement for cross-chapter drag preview
  const [virtualSceneIds, setVirtualSceneIds] = useState<Record<string, string[]> | null>(null);
  const openEditorAt = useEditorStore((s) => s.open);
  const goals = useBookStore((s) => s.goals);
  const timelineEvents = useBookStore((s) => s.timelineEvents) ?? [];

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [showSceneForm, setShowSceneForm] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'chapter' | 'scene'; id: string } | null>(null);
  const [eventsDialog, setEventsDialog] = useState<{ title: string; events: TimelineEvent[] } | null>(null);

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);
  const frontMatter = sortedChapters.find(c => c.type === 'front_matter');
  const backMatter = sortedChapters.find(c => c.type === 'back_matter');
  const regularChapters = sortedChapters.filter(c => (c.type ?? 'chapter') === 'chapter');

  // Find which chapter contains a scene
  const findChapterForScene = useCallback((sceneId: string) => {
    return chapters.find((c) => c.sceneIds.includes(sceneId));
  }, [chapters]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveSceneId(event.active.id as string);
    setVirtualSceneIds(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !active) {
      setVirtualSceneIds(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const sourceChapter = findChapterForScene(activeId);
    if (!sourceChapter) return;

    // Check if over another scene
    let targetChapter = findChapterForScene(overId);
    let targetIndex = -1;

    if (targetChapter) {
      targetIndex = targetChapter.sceneIds.indexOf(overId);
    } else {
      // Check chapter drop zones
      const isChapterDropZone = overId.startsWith('chapter-drop-');
      const chapterDropZoneId = isChapterDropZone ? overId.replace('chapter-drop-', '') : null;
      
      const isChapterHeader = overId.startsWith('chapter-header-');
      const chapterHeaderId = isChapterHeader ? overId.replace('chapter-header-', '') : null;

      const destChapterId = chapterDropZoneId || chapterHeaderId;
      if (destChapterId) {
        targetChapter = chapters.find((c) => c.id === destChapterId);
        if (targetChapter) {
          targetIndex = targetChapter.sceneIds.length;
        }
      }
    }

    if (!targetChapter) {
      setVirtualSceneIds(null);
      return;
    }

    // Same chapter - let SortableContext handle it naturally
    if (sourceChapter.id === targetChapter.id) {
      setVirtualSceneIds(null);
      return;
    }

    // Different chapter - create virtual arrangement
    const sourceSceneIds = sourceChapter.sceneIds.filter(id => id !== activeId);
    const targetSceneIds = [...targetChapter.sceneIds];
    
    // Insert at the right position
    if (targetIndex >= 0 && targetIndex < targetSceneIds.length) {
      targetSceneIds.splice(targetIndex, 0, activeId);
    } else {
      targetSceneIds.push(activeId);
    }

    setVirtualSceneIds({
      [sourceChapter.id]: sourceSceneIds,
      [targetChapter.id]: targetSceneIds,
    });
  }, [findChapterForScene, chapters]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    // Capture virtual state for index calculation before resetting
    const virtualArrangement = virtualSceneIds;
    setActiveSceneId(null);
    setVirtualSceneIds(null);
    
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceChapter = findChapterForScene(activeId);
    if (!sourceChapter) return;

    // If we have a virtual arrangement with cross-chapter move, commit it
    if (virtualArrangement) {
      // Find which chapter now contains the scene in virtual state
      const targetChapterId = Object.entries(virtualArrangement).find(
        ([, sceneIds]) => sceneIds.includes(activeId)
      )?.[0];
      
      if (targetChapterId && targetChapterId !== sourceChapter.id) {
        const newIndex = virtualArrangement[targetChapterId].indexOf(activeId);
        moveScene(activeId, targetChapterId, newIndex >= 0 ? newIndex : 0);
        return;
      }
    }
    
    // Same ID means no move needed (same position in same chapter)
    if (activeId === overId) return;

    // Check if dropping on another scene
    const targetChapter = findChapterForScene(overId);
    
    // Check if dropping on a chapter droppable zone
    const isChapterDropZone = overId.startsWith('chapter-drop-');
    const chapterDropZoneId = isChapterDropZone ? overId.replace('chapter-drop-', '') : null;
    
    // Check if dropping on a chapter header (entire card)
    const isChapterHeader = overId.startsWith('chapter-header-');
    const chapterHeaderId = isChapterHeader ? overId.replace('chapter-header-', '') : null;

    if (targetChapter) {
      // Dropping on another scene
      if (sourceChapter.id === targetChapter.id) {
        // Same chapter: reorder
        const oldIndex = sourceChapter.sceneIds.indexOf(activeId);
        const newIndex = targetChapter.sceneIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(sourceChapter.sceneIds, oldIndex, newIndex);
        reorderScenes(sourceChapter.id, reordered);
      } else {
        // Different chapter: move scene
        const newIndex = targetChapter.sceneIds.indexOf(overId);
        moveScene(activeId, targetChapter.id, newIndex >= 0 ? newIndex : targetChapter.sceneIds.length);
      }
    } else if (chapterDropZoneId) {
      // Dropping on empty chapter scene list zone
      const destChapter = chapters.find((c) => c.id === chapterDropZoneId);
      if (destChapter && destChapter.id !== sourceChapter.id) {
        moveScene(activeId, destChapter.id, destChapter.sceneIds.length);
      }
    } else if (chapterHeaderId) {
      // Dropping on chapter header (entire card) — add to end of chapter
      const destChapter = chapters.find((c) => c.id === chapterHeaderId);
      if (destChapter && destChapter.id !== sourceChapter.id) {
        moveScene(activeId, destChapter.id, destChapter.sceneIds.length);
      }
    }
  }, [virtualSceneIds, findChapterForScene, chapters, reorderScenes, moveScene]);

  // Get active scene for drag overlay
  const activeScene = activeSceneId ? scenes.find((s) => s.id === activeSceneId) : null;

  const renderSceneList = (chapter: Chapter) => {
    // Use virtual scene arrangement during cross-chapter drag, otherwise use actual
    const sceneIds = virtualSceneIds?.[chapter.id] ?? chapter.sceneIds;
    const chapterScenes = sceneIds
      .map((sid) => scenes.find((s) => s.id === sid))
      .filter(Boolean) as Scene[];
    const isExpanded = expanded[chapter.id] === true;
    const isSpecial = chapter.type === 'front_matter' || chapter.type === 'back_matter';

    if (!isExpanded) return null;

    return (
      <DroppableSceneList chapterId={chapter.id}>
        <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
          {chapterScenes.map((scene, sceneIdx) => (
            <SortableSceneItem
              key={scene.id}
              scene={scene}
              sceneIdx={sceneIdx}
              isSpecial={isSpecial}
              characters={characters}
              places={places}
              maps={maps}
              writingMode={writingMode}
              countUnit={countUnit}
              goals={goals}
              scenes={scenes}
              timelineEvents={timelineEvents}
              onNavigate={navigate}
              onOpenEditor={openEditorAt}
              onUpdateScene={updateScene}
              onEditScene={setEditingScene}
              onDeleteScene={(id) => setDeleteTarget({ type: 'scene', id })}
              onShowEvents={(title, events) => setEventsDialog({ title, events })}
            />
          ))}
        </SortableContext>

        <button
          onClick={() => setShowSceneForm(chapter.id)}
          className="w-full py-2 text-sm text-ink-200 border border-dashed border-parchment-300 rounded-lg
                     hover:border-gold-400 hover:text-ink-300 transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" /> Ajouter une scène
        </button>
      </DroppableSceneList>
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
      <DroppableChapter chapterId={chapter.id}>
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
            {(() => {
              const sectionEvents = timelineEvents.filter((e) => e.chapterId === chapter.id);
              if (sectionEvents.length === 0) return null;
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEventsDialog({
                      title: label,
                      events: sectionEvents,
                    });
                  }}
                  className="flex items-center gap-1 text-xs text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
                  title={`${sectionEvents.length} événement${sectionEvents.length > 1 ? 's' : ''}`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  {sectionEvents.length}
                </button>
              );
            })()}
          </div>
          {renderSceneList(chapter)}
        </div>
      </DroppableChapter>
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

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
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
            const completedScenes = chapterScenes.filter((s) => getSceneProgress(s, scenes, goals) >= 1).length;

            return (
              <DroppableChapter key={chapter.id} chapterId={chapter.id}>
                <div className="card-fantasy overflow-hidden">
                  {/* Chapter Header */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-parchment-100 transition-colors"
                    onClick={() => toggleExpand(chapter.id)}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: chapter.color }} />
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-ink-300" /> : <ChevronRight className="w-4 h-4 text-ink-300" />}
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-ink-400 italic">
                        Chapitre {chapter.number}{chapter.title ? ` — ${chapter.title}` : ''}
                      </h3>
                      {chapter.synopsis && (
                        <p className="text-xs text-ink-200 mt-0.5 whitespace-pre-line">{chapter.synopsis}</p>
                      )}
                    </div>
                    <span className="text-xs text-ink-200">{completedScenes}/{chapterScenes.length} scènes</span>
                    {(() => {
                      const chapterEvents = timelineEvents.filter((e) => e.chapterId === chapter.id);
                      if (chapterEvents.length === 0) return null;
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventsDialog({
                              title: `Chapitre ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}`,
                              events: chapterEvents,
                            });
                          }}
                          className="flex items-center gap-1 text-xs text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
                          title={`${chapterEvents.length} événement${chapterEvents.length > 1 ? 's' : ''}`}
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          {chapterEvents.length}
                        </button>
                      );
                    })()}
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

                  {renderSceneList(chapter)}
                </div>
              </DroppableChapter>
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
                <div className="px-4 pb-4 mt-4">
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
                      {glossaryEntries.map((entry) => {
                        const IconComp = entry.type === 'character' ? User : entry.type === 'place' ? MapPin : Globe;
                        const navigateTo = entry.type === 'character' ? `/characters/${entry.id}` : entry.type === 'place' ? `/places?placeId=${entry.id}` : `/world?noteId=${entry.id}`;
                        return (
                          <div
                            key={`${entry.type}-${entry.id}`}
                            className="flex items-center gap-3 bg-parchment-100 rounded-lg px-3 py-2 group"
                          >
                            <IconComp className="w-4 h-4 text-ink-300 flex-shrink-0" />
                            <span className="flex-1 min-w-0 text-sm font-medium text-ink-500 truncate">{entry.name}</span>
                            <button
                              onClick={() => navigate(navigateTo)}
                              className="btn-ghost p-1 text-ink-200 hover:text-bordeaux-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              title="Voir la fiche"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveFromGlossary(entry)}
                              className="btn-ghost p-1 text-ink-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              title="Retirer du glossaire"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
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

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeScene && (() => {
          const sceneChars = activeScene.characterIds
            .map((cid) => characters.find((c) => c.id === cid))
            .filter(Boolean);
          const scenePlace = activeScene.placeId ? places.find((p) => p.id === activeScene.placeId) : null;
          return (
            <div className="bg-parchment-100 rounded-lg p-3 shadow-lg ring-2 ring-gold-400">
              <div className="flex items-start gap-3">
                <GripVertical className="w-4 h-4 text-ink-300 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-ink-500 text-sm">
                      {activeScene.title || 'Scène'}
                    </h4>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', SCENE_STATUS_COLORS[activeScene.status])}>
                      {SCENE_STATUS_LABELS[activeScene.status]}
                    </span>
                  </div>
                  {(sceneChars.length > 0 || scenePlace) && (
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
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>

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

      {eventsDialog && (
        <EventsListDialog
          title={eventsDialog.title}
          events={eventsDialog.events}
          characters={characters}
          places={places}
          onClose={() => setEventsDialog(null)}
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
            <label className="label-field">Description</label>
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
  const { characters, places } = useEncyclopediaStore();
  const goals = useBookStore((s) => s.goals);
  const writingMode = useBookStore((s) => s.writingMode);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const addScene = useBookStore((s) => s.addScene);
  const updateScene = useBookStore((s) => s.updateScene);
  const timelineEvents = useBookStore((s) => s.timelineEvents) ?? [];

  // Check if this scene is linked to a timeline event
  const linkedEvent = scene ? timelineEvents.find((e) => e.sceneId === scene.id) : null;

  const [title, setTitle] = useState(scene?.title ?? '');
  const [description, setDescription] = useState(scene?.description ?? '');
  const [characterIds, setCharacterIds] = useState<string[]>(scene?.characterIds ?? []);
  const [placeId, setPlaceId] = useState(scene?.placeId ?? '');
  const [hasDate, setHasDate] = useState(!!(scene?.startDate) || !!linkedEvent);
  const [startDate, setStartDate] = useState(scene?.startDate ?? linkedEvent?.startDate ?? new Date().toISOString().slice(0, 10));
  const [includeTime, setIncludeTime] = useState(!!(scene?.startTime ?? linkedEvent?.startTime));
  const [startTime, setStartTime] = useState(scene?.startTime ?? linkedEvent?.startTime ?? '00:00');
  const [duration, setDuration] = useState<EventDuration>(scene?.duration ?? linkedEvent?.duration ?? { value: 1, unit: 'days' });
  const allScenes = useBookStore((s) => s.scenes);
  const [currentWordCount, setCurrentWordCount] = useState(scene?.currentWordCount ?? 0);
  const [status, setStatus] = useState<SceneStatus>(scene?.status ?? 'outline');
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const hasBookLevelGoal = goals.mode !== 'none';

  const isDirty = useCallback(() => {
    if (!scene) {
      return !!(title || description || characterIds.length > 0 || placeId || status !== 'outline' || currentWordCount > 0);
    }
    return (
      title !== (scene.title ?? '') ||
      description !== (scene.description ?? '') ||
      JSON.stringify(characterIds) !== JSON.stringify(scene.characterIds ?? []) ||
      placeId !== (scene.placeId ?? '') ||
      status !== (scene.status ?? 'outline') ||
      currentWordCount !== (scene.currentWordCount ?? 0) ||
      hasDate !== (!!(scene.startDate) || !!linkedEvent) ||
      (hasDate && startDate !== (scene.startDate ?? linkedEvent?.startDate ?? '')) ||
      (hasDate && includeTime !== !!(scene.startTime ?? linkedEvent?.startTime)) ||
      (hasDate && includeTime && startTime !== (scene.startTime ?? linkedEvent?.startTime ?? '00:00')) ||
      (hasDate && JSON.stringify(duration) !== JSON.stringify(scene.duration ?? linkedEvent?.duration ?? { value: 1, unit: 'days' }))
    );
  }, [title, description, characterIds, placeId, status, currentWordCount, hasDate, startDate, includeTime, startTime, duration, scene, linkedEvent]);

  const handleSave = () => {
    const data: Partial<Scene> & { chapterId?: string } = {
      title: title.trim(),
      description,
      characterIds,
      placeId: placeId || undefined,
      startDate: hasDate ? startDate : undefined,
      startTime: hasDate && includeTime ? startTime : undefined,
      duration: hasDate ? duration : undefined,
      startDateTime: undefined,
      endDateTime: undefined,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const toggleCharacter = (id: string) => {
    setCharacterIds((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-2xl mx-4 my-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300 flex-shrink-0">
          <h3 className="font-display text-xl font-bold text-ink-500">
            {scene ? 'Modifier la scène' : 'Nouvelle scène'}
          </h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

            {characters.length > 0 && (
              <div>
                <label className="label-field">Personnages présents</label>
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

            <div>
              <label className="label-field">Lieu</label>
              <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="input-field">
                <option value="">Aucun</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Date & Duration (dans l'histoire) */}
            <div>
              <label className="label-field flex items-center gap-2">
                Temporalité dans l'histoire
                <input
                  type="checkbox"
                  checked={hasDate}
                  onChange={(e) => setHasDate(e.target.checked)}
                  disabled={!!linkedEvent}
                  className="rounded border-parchment-300 disabled:opacity-50"
                />
              </label>
              {linkedEvent && (
                <p className="text-xs text-ink-200 italic mt-0.5">
                  Liée à l'événement « {linkedEvent.title} » — les dates sont synchronisées.
                </p>
              )}
              {hasDate && (
                <div className="space-y-3 mt-2 border-l-2 border-parchment-200 ml-1 pl-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-ink-300 mb-1 block">Date de début</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-300 mb-1 block flex items-center gap-2">
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
                    <label className="text-xs text-ink-300 mb-1 block">Durée</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={duration.value}
                        onChange={(e) => setDuration({ ...duration, value: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="input-field w-20 text-sm"
                      />
                      <select
                        value={duration.unit}
                        onChange={(e) => setDuration({ ...duration, unit: e.target.value as DurationUnit })}
                        className="input-field w-28 text-sm"
                      >
                        <option value="hours">heure(s)</option>
                        <option value="days">jour(s)</option>
                        <option value="months">mois</option>
                        <option value="years">année(s)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {hasBookLevelGoal && scene && (
                <div>
                  <label className="label-field">Objectif {countUnitLabel(countUnit)}</label>
                  <p className="input-field bg-parchment-100 text-ink-300 cursor-not-allowed select-none">
                    {(getSceneTarget(scene, allScenes, goals) ?? '—').toLocaleString('fr-FR')} <span className="text-xs">(calculé)</span>
                  </p>
                </div>
              )}
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
          </div>
          <div className="flex justify-end gap-3 p-6 border-t border-parchment-300 flex-shrink-0">
            <button type="button" onClick={handleClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{scene ? 'Enregistrer' : 'Créer'}</button>
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
              <button onClick={() => { setShowUnsavedConfirm(false); handleSave(); }} className="btn-primary text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventsListDialog({ title, events, characters, places, onClose }: {
  title: string;
  events: TimelineEvent[];
  characters: { id: string; name: string; surname?: string }[];
  places: { id: string; name: string }[];
  onClose: () => void;
}) {
  const sortedEvents = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.order - b.order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-parchment-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-bordeaux-500" />
            <h3 className="font-display text-lg font-bold text-ink-500">
              {events.length} événement{events.length > 1 ? 's' : ''}
            </h3>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <p className="px-5 pt-3 text-sm text-ink-300">{title}</p>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {sortedEvents.map((event) => {
            const eventChars = event.characterIds
              .map((cid) => characters.find((c) => c.id === cid))
              .filter(Boolean);
            const eventPlace = event.placeId ? places.find((p) => p.id === event.placeId) : null;

            return (
              <div key={event.id} className="bg-parchment-100 rounded-lg p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-ink-500 text-sm">{event.title}</h4>
                  <span className="text-xs text-ink-300 whitespace-nowrap flex-shrink-0">
                    {new Date(event.startDate + 'T00:00:00').toLocaleDateString('fr-FR')}
                    {event.startTime ? ` ${event.startTime}` : ''}
                  </span>
                </div>
                <p className="text-xs text-ink-200">{formatDuration(event.duration)}</p>
                {event.description && (
                  <p className="text-xs text-ink-300 whitespace-pre-line">{event.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-ink-200">
                  {eventChars.length > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {eventChars.map((c) => c!.name).join(', ')}
                    </span>
                  )}
                  {eventPlace && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {eventPlace.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end p-5 border-t border-parchment-300 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Fermer</button>
        </div>
      </div>
    </div>
  );
}
