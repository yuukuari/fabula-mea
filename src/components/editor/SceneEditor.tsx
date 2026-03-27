import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Minus, User, MapPin, ChevronRight, BookOpen, Info, PanelLeft, Menu } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEditorStore } from '@/store/useEditorStore';
import { SceneInlineEditor, countWords } from './SceneInlineEditor';
import { cn, SCENE_STATUS_LABELS } from '@/lib/utils';
import type { Scene, Chapter } from '@/types';

const STATUS_DOT: Record<string, string> = {
  outline:  'bg-ink-200',
  draft:    'bg-gold-400',
  revision: 'bg-bordeaux-400',
  complete: 'bg-green-500',
};

function DetailModal({
  item,
  onClose,
  characters,
  places,
}: {
  item: { type: 'scene'; data: Scene; sceneIndex: number } | { type: 'chapter'; data: Chapter; scenes: Scene[] };
  onClose: () => void;
  characters: ReturnType<typeof useBookStore.getState>['characters'];
  places: ReturnType<typeof useBookStore.getState>['places'];
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <button onClick={onClose} className="absolute top-3 right-3 btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>

        {item.type === 'chapter' ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.data.color }} />
              <h3 className="font-display font-bold text-ink-500">Ch. {item.data.number}{item.data.title ? ` — ${item.data.title}` : ''}</h3>
            </div>
            {item.data.synopsis
              ? <p className="text-sm text-ink-300 italic leading-relaxed mb-3">{item.data.synopsis}</p>
              : <p className="text-sm text-ink-200 italic mb-3">Pas de synopsis</p>
            }
            <p className="text-xs text-ink-200">{item.scenes.length} scène{item.scenes.length !== 1 ? 's' : ''}</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', STATUS_DOT[item.data.status])} />
              <h3 className="font-display font-bold text-ink-500">{item.data.title || `Scène ${item.sceneIndex + 1}`}</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <span className={cn(
                'inline-block text-xs px-2 py-0.5 rounded-full font-medium',
                item.data.status === 'outline'  && 'bg-parchment-200 text-ink-400',
                item.data.status === 'draft'    && 'bg-gold-100 text-gold-600',
                item.data.status === 'revision' && 'bg-bordeaux-100 text-bordeaux-500',
                item.data.status === 'complete' && 'bg-green-100 text-green-700',
              )}>
                {SCENE_STATUS_LABELS[item.data.status]}
              </span>
              {item.data.description && (
                <p className="text-ink-300 italic leading-relaxed">{item.data.description}</p>
              )}
              {item.data.characterIds.length > 0 && (
                <div className="flex items-start gap-1.5 text-ink-400">
                  <User className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{item.data.characterIds
                    .map((id) => characters.find((c) => c.id === id)?.name)
                    .filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {item.data.placeId && (
                <div className="flex items-center gap-1.5 text-ink-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{places.find((p) => p.id === item.data.placeId)?.name ?? ''}</span>
                </div>
              )}
              {!item.data.description && item.data.characterIds.length === 0 && !item.data.placeId && (
                <p className="text-ink-200 italic text-xs">Pas de détail renseigné</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SceneEditor() {
  const { isOpen, entrySceneId, minimize, close } = useEditorStore();
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);

  const [visibleSceneId, setVisibleSceneId] = useState<string | null>(entrySceneId);
  const [detailModal, setDetailModal] = useState<
    | { type: 'scene'; data: Scene; sceneIndex: number }
    | { type: 'chapter'; data: Chapter; scenes: Scene[] }
    | null
  >(null);

  // Desktop : panneau replié ou non
  // Mobile : drawer ouvert ou non
  const [navOpen, setNavOpen] = useState(true);

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
    const offset = el.offsetTop - 80;
    panel.scrollTo({ top: offset, behavior: 'smooth' });
    setVisibleSceneId(sceneId);
  }, []);

  // Sur mobile, fermer le drawer après navigation
  const handleSceneClick = useCallback((sceneId: string) => {
    scrollToScene(sceneId);
    // Ferme le drawer si on est sur mobile (< sm)
    if (window.innerWidth < 640) setNavOpen(false);
  }, [scrollToScene]);

  // Scroll initial vers la scène d'entrée
  useEffect(() => {
    if (!isOpen || !entrySceneId || didScrollRef.current) return;
    const tryScroll = () => {
      if (sceneRefs.current[entrySceneId]) {
        scrollToScene(entrySceneId);
        didScrollRef.current = true;
      }
    };
    const t = setTimeout(tryScroll, 100);
    return () => clearTimeout(t);
  }, [isOpen, entrySceneId, scrollToScene]);

  // Reset scroll ref + nav quand on rouvre
  useEffect(() => {
    if (isOpen) {
      didScrollRef.current = false;
      setVisibleSceneId(entrySceneId);
      // Réinitialise l'état du nav : ouvert sur desktop, fermé sur mobile
      setNavOpen(window.innerWidth >= 640);
    }
  }, [isOpen, entrySceneId]);

  // IntersectionObserver
  useEffect(() => {
    if (!isOpen) return;
    const panel = rightPanelRef.current;
    if (!panel) return;

    const observers: IntersectionObserver[] = [];
    Object.entries(sceneRefs.current).forEach(([sceneId, el]) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setVisibleSceneId(sceneId); },
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') minimize(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, minimize]);

  if (!isOpen) return null;

  // Stats globales
  const totalWords = scenes.reduce((sum, sc) => sum + countWords(sc.content ?? ''), 0);
  const totalTarget = scenes.reduce((sum, sc) => sum + sc.targetWordCount, 0);

  const visibleScene = visibleSceneId ? scenes.find((s) => s.id === visibleSceneId) : null;
  const visibleChapter = visibleScene ? chapters.find((c) => c.id === visibleScene.chapterId) : null;

  // ── Contenu du panneau de navigation (partagé desktop + mobile) ──
  const navContent = (
    <>
      <div className="px-3 py-3 border-b border-parchment-200 flex items-center justify-between shrink-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-200 font-semibold">Plan du livre</p>
        {/* Bouton fermer sur mobile uniquement */}
        <button
          onClick={() => setNavOpen(false)}
          className="sm:hidden btn-ghost p-1 text-ink-200 hover:text-ink-400"
          title="Fermer le plan"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {sortedChapters.map((chapter) => {
          const chScenes = getChapterScenes(chapter.id);
          return (
            <div key={chapter.id} className="mb-1">
              {/* Chapter row */}
              <button
                onClick={() => { const s = chScenes[0]; if (s) handleSceneClick(s.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left
                           hover:bg-parchment-200/60 transition-colors group"
              >
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: chapter.color }} />
                <span className="text-xs font-semibold text-ink-400 truncate flex-1">
                  Ch. {chapter.number}{chapter.title ? ` — ${chapter.title}` : ''}
                </span>
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setDetailModal({ type: 'chapter', data: chapter, scenes: chScenes }); }}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-ink-200
                             hover:text-ink-400 hover:bg-parchment-300 transition-all shrink-0"
                  title="Détail du chapitre"
                >
                  <Info className="w-3.5 h-3.5" />
                </span>
              </button>

              {/* Scenes */}
              {chScenes.map((scene, sceneIdx) => {
                const isVisible = visibleSceneId === scene.id;
                const wc = countWords(scene.content ?? '');
                const sceneLabel = scene.title || `Scène ${sceneIdx + 1}`;
                return (
                  <button
                    key={scene.id}
                    onClick={() => handleSceneClick(scene.id)}
                    className={cn(
                      'w-full flex items-center gap-2 pl-5 pr-2 py-1.5 text-left transition-colors group',
                      isVisible
                        ? 'bg-bordeaux-50 border-l-2 border-bordeaux-400'
                        : 'hover:bg-parchment-200/60 border-l-2 border-transparent'
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[scene.status])} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs truncate', isVisible ? 'text-bordeaux-600 font-medium' : 'text-ink-400')}>
                        {sceneLabel}
                      </p>
                      <p className="text-[10px] text-ink-200 mt-0.5">
                        {wc} / {scene.targetWordCount} mots
                      </p>
                    </div>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setDetailModal({ type: 'scene', data: scene, sceneIndex: sceneIdx }); }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-ink-200
                                 hover:text-ink-400 hover:bg-parchment-300 transition-all shrink-0"
                      title="Détail de la scène"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {sortedChapters.length === 0 && (
          <p className="text-xs text-ink-200 italic px-3 py-4">Aucun chapitre créé</p>
        )}
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-parchment-50">

      {/* ── Top bar ── */}
      <div className="h-12 border-b border-parchment-200 bg-parchment-100/90 backdrop-blur-sm
                      flex items-center px-3 gap-2 shrink-0 z-10">

        {/* Bouton toggle plan — burger sur mobile, panel sur desktop */}
        <button
          onClick={() => setNavOpen((v) => !v)}
          className={cn(
            'btn-ghost p-1.5 shrink-0 transition-colors',
            navOpen && 'text-bordeaux-500'
          )}
          title={navOpen ? 'Replier le plan' : 'Afficher le plan'}
        >
          <Menu className="w-4 h-4 sm:hidden" />
          <PanelLeft className="w-4 h-4 hidden sm:block" />
        </button>

        {/* Breadcrumb en cours */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-xs text-ink-300">
          {visibleChapter && (
            <>
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Ch. {visibleChapter.number}{visibleChapter.title ? ` — ${visibleChapter.title}` : ''}</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
            </>
          )}
          {visibleScene && (() => {
            const chScenes = visibleChapter ? getChapterScenes(visibleChapter.id) : [];
            const idx = chScenes.findIndex((s) => s.id === visibleScene.id);
            return (
              <span className="font-medium text-ink-400 truncate">
                {visibleScene.title || `Scène ${idx + 1}`}
              </span>
            );
          })()}
        </div>

        {/* Stats globales */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-ink-200 shrink-0">
          <span>{totalWords.toLocaleString('fr-FR')} mots</span>
          {totalTarget > 0 && (
            <span>/ {totalTarget.toLocaleString('fr-FR')} objectif</span>
          )}
        </div>

        {/* Sauvegarde auto */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-ink-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Sauvegarde auto</span>
        </div>

        <button onClick={minimize} className="btn-ghost p-1.5 shrink-0" title="Réduire (Échap)">
          <Minus className="w-4 h-4" />
        </button>
        <button onClick={close} className="btn-ghost p-1.5 shrink-0 hover:text-red-500" title="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Split panel ── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* ── Desktop : sidebar repliable ── */}
        <div
          className={cn(
            'hidden sm:flex flex-col shrink-0 border-r border-parchment-200 bg-parchment-100/60',
            'overflow-hidden transition-all duration-200 ease-in-out',
            navOpen ? 'w-60' : 'w-0 border-r-0'
          )}
        >
          <div className="w-60 flex flex-col flex-1 min-h-0">
            {navContent}
          </div>
        </div>

        {/* ── Mobile : backdrop ── */}
        {navOpen && (
          <div
            className="sm:hidden fixed inset-0 bg-black/20 z-30"
            style={{ top: '3rem' }}
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* ── Mobile : drawer ── */}
        <div
          className={cn(
            'sm:hidden fixed left-0 bottom-0 z-40 w-72 flex flex-col',
            'bg-parchment-50 border-r border-parchment-200 shadow-2xl',
            'transition-transform duration-200 ease-in-out',
            navOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          style={{ top: '3rem' }}
        >
          {navContent}
        </div>

        {/* ── RIGHT: Livre continu ── */}
        <div ref={rightPanelRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 sm:px-14 py-10 sm:py-12 pb-32">
            {sortedChapters.map((chapter) => {
              const chScenes = getChapterScenes(chapter.id);
              return (
                <div key={chapter.id} className="mb-12">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: chapter.color }} />
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-400">
                      Chapitre {chapter.number}{chapter.title ? ` — ${chapter.title}` : ''}
                    </h2>
                  </div>

                  {chScenes.map((scene, idx) => (
                    <div
                      key={scene.id}
                      ref={(el) => { sceneRefs.current[scene.id] = el; }}
                      id={`scene-${scene.id}`}
                      className={cn('mb-16', idx > 0 && 'border-t border-parchment-200 pt-12')}
                    >
                      {(scene.title || scene.description) && (
                        <div className="mb-4">
                          {scene.title && (
                            <h3 className="font-display text-lg sm:text-xl font-semibold text-ink-500 mb-1">
                              {scene.title}
                            </h3>
                          )}
                          {scene.description && (
                            <p className="text-sm text-ink-200 italic font-serif border-l-2 border-parchment-300 pl-3">
                              {scene.description}
                            </p>
                          )}
                        </div>
                      )}

                      <SceneInlineEditor scene={scene} onFocus={() => {}} />

                      <div className="mt-3 flex items-center gap-2">
                        {(() => {
                          const wc = countWords(scene.content ?? '');
                          const pct = scene.targetWordCount > 0
                            ? Math.min(100, Math.round((wc / scene.targetWordCount) * 100))
                            : 0;
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

      {/* ── Detail modal ── */}
      {detailModal && (
        <DetailModal
          item={detailModal}
          onClose={() => setDetailModal(null)}
          characters={characters}
          places={places}
        />
      )}
    </div>
  );
}
