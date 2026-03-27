import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Minus, User, MapPin, ChevronRight, BookOpen } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEditorStore } from '@/store/useEditorStore';
import { SceneInlineEditor, countWords } from './SceneInlineEditor';
import { cn } from '@/lib/utils';
import type { Scene } from '@/types';

export function SceneEditor() {
  const { isOpen, entrySceneId, minimize, close } = useEditorStore();
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);

  // Scène actuellement visible dans le panneau droit (suivi par IntersectionObserver)
  const [visibleSceneId, setVisibleSceneId] = useState<string | null>(entrySceneId);
  const [focusedSceneId, setFocusedSceneId] = useState<string | null>(null);
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);

  const sceneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);

  // Tri chapitres + scènes
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);

  const getChapterScenes = (chapterId: string): Scene[] =>
    (chapters.find((c) => c.id === chapterId)?.sceneIds ?? [])
      .map((id) => scenes.find((s) => s.id === id))
      .filter((s): s is Scene => !!s);

  // Scroll vers une scène (ancre)
  const scrollToScene = useCallback((sceneId: string) => {
    const el = sceneRefs.current[sceneId];
    const panel = rightPanelRef.current;
    if (!el || !panel) return;
    const offset = el.offsetTop - 80; // 80px = top bar + toolbar heights
    panel.scrollTo({ top: offset, behavior: 'smooth' });
    setVisibleSceneId(sceneId);
  }, []);

  // Scroll initial vers la scène d'entrée
  useEffect(() => {
    if (!isOpen || !entrySceneId || didScrollRef.current) return;
    const tryScroll = () => {
      if (sceneRefs.current[entrySceneId]) {
        scrollToScene(entrySceneId);
        didScrollRef.current = true;
      }
    };
    // Petit délai pour laisser le DOM se rendre
    const t = setTimeout(tryScroll, 100);
    return () => clearTimeout(t);
  }, [isOpen, entrySceneId, scrollToScene]);

  // Reset scroll ref quand on rouvre
  useEffect(() => {
    if (isOpen) {
      didScrollRef.current = false;
      setVisibleSceneId(entrySceneId);
    }
  }, [isOpen, entrySceneId]);

  // IntersectionObserver : met à jour la scène visible selon le scroll
  useEffect(() => {
    if (!isOpen) return;
    const panel = rightPanelRef.current;
    if (!panel) return;

    const observers: IntersectionObserver[] = [];

    Object.entries(sceneRefs.current).forEach(([sceneId, el]) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setVisibleSceneId(sceneId);
        },
        { root: panel, threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scenes.length, chapters.length]);

  // Escape → minimize
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') minimize();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, minimize]);

  if (!isOpen) return null;

  // Stats globales
  const totalWords = scenes.reduce((sum, sc) => sum + countWords(sc.content ?? ''), 0);
  const totalTarget = scenes.reduce((sum, sc) => sum + sc.targetWordCount, 0);

  const visibleScene = visibleSceneId ? scenes.find((s) => s.id === visibleSceneId) : null;
  const visibleChapter = visibleScene ? chapters.find((c) => c.id === visibleScene.chapterId) : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-parchment-50">
      {/* ── Top bar ── */}
      <div className="h-12 border-b border-parchment-200 bg-parchment-100/90 backdrop-blur-sm
                      flex items-center px-4 gap-3 shrink-0 z-10">
        {/* Breadcrumb en cours */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-xs text-ink-300">
          {visibleChapter && (
            <>
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{visibleChapter.title}</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
            </>
          )}
          {visibleScene && (
            <span className="font-medium text-ink-400 truncate">{visibleScene.title}</span>
          )}
        </div>

        {/* Stats globales */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-ink-200 shrink-0">
          <span>{totalWords.toLocaleString('fr-FR')} mots</span>
          {totalTarget > 0 && (
            <span>/ {totalTarget.toLocaleString('fr-FR')} objectif</span>
          )}
        </div>

        {/* Sauvegarde auto */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Sauvegarde auto</span>
        </div>

        <button onClick={minimize} className="btn-ghost p-1.5" title="Réduire (Échap)">
          <Minus className="w-4 h-4" />
        </button>
        <button onClick={close} className="btn-ghost p-1.5 hover:text-red-500" title="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Split panel ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: Navigation chapitres / scènes ── */}
        <div className="w-60 shrink-0 border-r border-parchment-200 bg-parchment-100/60
                        overflow-y-auto flex flex-col">
          <div className="px-3 py-3 border-b border-parchment-200">
            <p className="text-[10px] uppercase tracking-wider text-ink-200 font-semibold">Plan du livre</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {sortedChapters.map((chapter) => {
              const chScenes = getChapterScenes(chapter.id);
              return (
                <div key={chapter.id} className="mb-1">
                  {/* Chapter header */}
                  <button
                    onClick={() => {
                      const firstScene = chScenes[0];
                      if (firstScene) scrollToScene(firstScene.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-parchment-200/60 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: chapter.color }} />
                    <span className="text-xs font-semibold text-ink-400 truncate">
                      Ch. {chapter.number} — {chapter.title}
                    </span>
                  </button>

                  {/* Scenes */}
                  {chScenes.map((scene) => {
                    const isVisible = visibleSceneId === scene.id;
                    const isFocused = focusedSceneId === scene.id;
                    const sceneChars = scene.characterIds
                      .map((id) => characters.find((c) => c.id === id))
                      .filter(Boolean);
                    const scenePlace = scene.placeId ? places.find((p) => p.id === scene.placeId) : null;
                    const wc = countWords(scene.content ?? '');

                    return (
                      <div key={scene.id} className="relative">
                        <button
                          onClick={() => scrollToScene(scene.id)}
                          onMouseEnter={() => setHoveredSceneId(scene.id)}
                          onMouseLeave={() => setHoveredSceneId(null)}
                          className={cn(
                            'w-full flex items-start gap-2 pl-7 pr-3 py-1.5 text-left transition-colors',
                            isVisible || isFocused
                              ? 'bg-bordeaux-50 border-l-2 border-bordeaux-400'
                              : 'hover:bg-parchment-200/60 border-l-2 border-transparent'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-xs truncate',
                              isVisible || isFocused ? 'text-bordeaux-600 font-medium' : 'text-ink-400'
                            )}>
                              {scene.title}
                            </p>
                            <p className="text-[10px] text-ink-200 mt-0.5">
                              {wc > 0 ? `${wc} / ${scene.targetWordCount} mots` : `0 / ${scene.targetWordCount} mots`}
                            </p>
                          </div>
                        </button>

                        {/* Tooltip au survol */}
                        {hoveredSceneId === scene.id && (scene.description || sceneChars.length > 0 || scenePlace) && (
                          <div className="absolute left-full top-0 ml-2 z-50 w-56
                                          bg-ink-500 text-parchment-100 rounded-xl shadow-2xl p-3
                                          text-xs pointer-events-none">
                            {scene.description && (
                              <p className="italic text-parchment-300 mb-2 line-clamp-3">{scene.description}</p>
                            )}
                            {sceneChars.length > 0 && (
                              <div className="flex items-start gap-1.5 mb-1">
                                <User className="w-3 h-3 shrink-0 mt-0.5 text-parchment-400" />
                                <span>{sceneChars.map((c) => c!.name).join(', ')}</span>
                              </div>
                            )}
                            {scenePlace && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 shrink-0 text-parchment-400" />
                                <span>{scenePlace.name}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {sortedChapters.length === 0 && (
              <p className="text-xs text-ink-200 italic px-3 py-4">Aucun chapitre créé</p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Livre continu ── */}
        <div ref={rightPanelRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 sm:px-14 py-12 pb-32">
            {sortedChapters.map((chapter) => {
              const chScenes = getChapterScenes(chapter.id);
              return (
                <div key={chapter.id} className="mb-12">
                  {/* Chapter heading */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: chapter.color }} />
                    <h2 className="font-display text-2xl font-bold text-ink-400">
                      Chapitre {chapter.number} — {chapter.title}
                    </h2>
                  </div>

                  {chScenes.map((scene, idx) => (
                    <div
                      key={scene.id}
                      ref={(el) => { sceneRefs.current[scene.id] = el; }}
                      id={`scene-${scene.id}`}
                      className={cn('mb-16', idx > 0 && 'border-t border-parchment-200 pt-12')}
                    >
                      {/* Scene heading */}
                      <div className="mb-4">
                        <h3 className="font-display text-xl font-semibold text-ink-500 mb-1">
                          {scene.title}
                        </h3>
                        {scene.description && (
                          <p className="text-sm text-ink-200 italic font-serif border-l-2 border-parchment-300 pl-3">
                            {scene.description}
                          </p>
                        )}
                      </div>

                      {/* Inline TipTap editor */}
                      <SceneInlineEditor
                        scene={scene}
                        onFocus={setFocusedSceneId}
                      />

                      {/* Word count badge */}
                      <div className="mt-3 flex items-center gap-2">
                        {(() => {
                          const wc = countWords(scene.content ?? '');
                          const pct = scene.targetWordCount > 0 ? Math.min(100, Math.round((wc / scene.targetWordCount) * 100)) : 0;
                          return (
                            <>
                              <div className="h-0.5 w-20 bg-parchment-200 rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', pct >= 100 ? 'bg-green-400' : 'bg-bordeaux-300')}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-ink-200">
                                {wc} / {scene.targetWordCount} mots
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {sortedChapters.length === 0 && (
              <div className="text-center py-20 text-ink-200">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-display text-lg">Commencez par créer des chapitres et des scènes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
