import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Minus, X, User, MapPin, ChevronRight, BookOpen, PanelLeft, PanelRight, Menu, Calendar, MessageCircle, BookText } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { useEditorStore } from '@/store/useEditorStore';
import { SceneInlineEditor, countWords } from './SceneInlineEditor';
import { SelfCommentPanel } from './SelfCommentPanel';
import { getSelectionOffsets } from '@/lib/review-highlights';
import { cn, SCENE_STATUS_LABELS, countCharacters, countUnitLabel, isSpecialChapter, getChapterShortLabel, getChapterLabel } from '@/lib/utils';
import { getTodayProgress } from '@/lib/calculations';
import type { Scene, Chapter, GlossaryEntry } from '@/types';

const STATUS_DOT: Record<string, string> = {
  outline:  'bg-ink-200',
  draft:    'bg-gold-400',
  revision: 'bg-bordeaux-400',
  complete: 'bg-green-500',
};

export function SceneEditor() {
  const { isOpen, entrySceneId, minimize, close } = useEditorStore();
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const { characters, places, worldNotes: allWorldNotes } = useEncyclopediaStore();
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const bookId = useBookStore((s) => s.id);
  const dailyGoal = useBookStore((s) => s.goals?.dailyGoal);
  const glossaryEnabled = useBookStore((s) => s.glossaryEnabled ?? false);
  const bookTitle = useBookStore((s) => s.title);
  const bookAuthor = useBookStore((s) => s.author);
  const layout = useBookStore((s) => s.layout);

  const [visibleSceneId, setVisibleSceneId] = useState<string | null>(entrySceneId);

  // Desktop : panneau replié ou non
  // Mobile : drawer ouvert ou non
  const [navOpen, setNavOpen] = useState(true);

  // Notes panel
  const [notesOpen, setNotesOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    selectedText: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const selfComments = useBookStore((s) => s.selfComments ?? []);

  const glossaryEntries = useMemo<GlossaryEntry[]>(() => {
    if (!glossaryEnabled) return [];
    return [
      ...characters.filter((c) => c.inGlossary).map((c) => ({
        id: c.id, type: 'character' as const,
        name: c.name + (c.surname ? ` ${c.surname}` : ''), description: c.description,
      })),
      ...places.filter((p) => p.inGlossary).map((p) => ({
        id: p.id, type: 'place' as const, name: p.name, description: p.description,
      })),
      ...allWorldNotes.filter((w) => w.inGlossary).map((w) => ({
        id: w.id, type: 'worldNote' as const, name: w.title, description: w.content,
      })),
    ].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [glossaryEnabled, characters, places, allWorldNotes]);

  const glossaryRef = useRef<HTMLDivElement | null>(null);

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

  // Handle text selection for self-comments
  const handleTextSelection = useCallback(() => {
    if (!notesOpen) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const text = selection.toString().trim();
    if (!text) return;

    // Find which scene container the selection is in
    const range = selection.getRangeAt(0);
    const container = range.startContainer.parentElement?.closest('[id^="scene-"]');
    if (!container) return;

    const sceneId = container.id.replace('scene-', '');

    // Find the .ProseMirror container within this scene
    const proseMirrorEl = container.querySelector('.ProseMirror');
    if (!proseMirrorEl || !proseMirrorEl.contains(range.startContainer)) return;

    const offsets = getSelectionOffsets(proseMirrorEl as HTMLElement);
    if (!offsets) return;

    setVisibleSceneId(sceneId);
    setPendingSelection({
      selectedText: offsets.text,
      startOffset: offsets.startOffset,
      endOffset: offsets.endOffset,
    });
  }, [notesOpen]);

  if (!isOpen) return null;

  // Stats globales
  const totalWords = scenes.reduce((sum, sc) => sum + countWords(sc.content ?? ''), 0);
  const totalTarget = scenes.reduce((sum, sc) => sum + sc.targetWordCount, 0);

  // Daily progress
  const totalCount = countUnit === 'characters'
    ? scenes.reduce((sum, sc) => sum + countCharacters(sc.content ?? ''), 0)
    : totalWords;
  const todayCount = bookId ? getTodayProgress(bookId, totalCount).todayCount : 0;

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
          const isSpecial = isSpecialChapter(chapter);
          // Hide special chapters that have no scenes
          if (isSpecial && chScenes.length === 0) return null;
          return (
            <div key={chapter.id} className="mb-1">
              {/* Chapter row */}
              <button
                onClick={() => { const s = chScenes[0]; if (s) handleSceneClick(s.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left
                           hover:bg-parchment-200/60 transition-colors group"
              >
                {!isSpecial && (
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: chapter.color }} />
                )}
                <span className={cn(
                  'text-xs truncate flex-1',
                  isSpecial ? 'font-medium text-ink-300 italic' : 'font-semibold text-ink-400'
                )}>
                  {getChapterShortLabel(chapter)}
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
                        {wc} / {scene.targetWordCount} {countUnitLabel(countUnit)}
                      </p>
                    </div>

                  </button>
                );
              })}
            </div>
          );
        })}

        {sortedChapters.length === 0 && (
          <p className="text-xs text-ink-200 italic px-3 py-4">Aucun chapitre créé</p>
        )}

        {/* Glossary entry in nav */}
        {glossaryEntries.length > 0 && (
          <div className="mb-1 mt-2 border-t border-parchment-200 pt-2">
            <button
              onClick={() => {
                const el = glossaryRef.current;
                const panel = rightPanelRef.current;
                if (el && panel) {
                  panel.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
                }
                if (window.innerWidth < 640) setNavOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left
                         hover:bg-parchment-200/60 transition-colors group"
            >
              <BookText className="w-3.5 h-3.5 text-ink-300 shrink-0" />
              <span className="text-xs font-semibold text-ink-400 truncate">Glossaire</span>
              <span className="text-[10px] text-ink-200 ml-auto">{glossaryEntries.length}</span>
            </button>
          </div>
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
          {visibleChapter && !isSpecialChapter(visibleChapter) && (
            <>
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{getChapterShortLabel(visibleChapter)}</span>
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
          <span>{totalWords.toLocaleString('fr-FR')} {countUnitLabel(countUnit)}</span>
          {totalTarget > 0 && (
            <span>/ {totalTarget.toLocaleString('fr-FR')} objectif</span>
          )}
        </div>

        {/* Daily progress indicator */}
        {dailyGoal && dailyGoal > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs shrink-0" title={`Aujourd'hui : ${todayCount.toLocaleString('fr-FR')} / ${dailyGoal.toLocaleString('fr-FR')} ${countUnit === 'characters' ? 'signes' : 'mots'}`}>
            <div className="w-16 h-1.5 bg-parchment-200 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', todayCount >= dailyGoal ? 'bg-green-500' : 'bg-bordeaux-400')}
                style={{ width: `${Math.min(100, (todayCount / dailyGoal) * 100)}%` }}
              />
            </div>
            <span className={cn('tabular-nums', todayCount >= dailyGoal ? 'text-green-600' : 'text-ink-200')}>
              {todayCount >= dailyGoal ? '✓' : `${todayCount}/${dailyGoal}`}
            </span>
          </div>
        )}

        {/* Sauvegarde auto */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-ink-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Sauvegarde auto</span>
        </div>

        {/* Toggle notes panel */}
        <button
          onClick={() => setNotesOpen((v) => !v)}
          className={cn(
            'btn-ghost p-1.5 shrink-0 transition-colors hidden sm:block',
            notesOpen && 'text-bordeaux-500'
          )}
          title={notesOpen ? 'Masquer les notes' : 'Afficher les notes'}
        >
          <MessageCircle className="w-4 h-4" />
          {visibleSceneId && selfComments.filter((c) => c.sceneId === visibleSceneId).length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-bordeaux-400 rounded-full" />
          )}
        </button>

        <button onClick={minimize} className="btn-ghost p-1.5 shrink-0" title="Réduire (Échap)">
          <Minus className="w-4 h-4" />
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
        <div ref={rightPanelRef} className="flex-1 overflow-y-auto" onMouseUp={handleTextSelection}>
          <div className="max-w-3xl mx-auto px-6 sm:px-14 py-10 sm:py-12 pb-32">
            {/* Cover + Title page */}
            {(layout?.coverFront || bookTitle) && (
              <div className="mb-16 text-center">
                {layout?.coverFront && (
                  <img src={layout.coverFront} alt="1ère de couverture" className="max-h-72 mx-auto rounded-lg shadow-sm mb-8" />
                )}
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-500">{bookTitle}</h1>
                {bookAuthor && <p className="text-lg text-ink-300 mt-2">{bookAuthor}</p>}
                <div className="border-b border-parchment-300 mt-12" />
              </div>
            )}

            {sortedChapters.map((chapter) => {
              const chScenes = getChapterScenes(chapter.id);
              const isSpecial = isSpecialChapter(chapter);
              // Hide special chapters that have no scenes
              if (isSpecial && chScenes.length === 0) return null;
              return (
                <div key={chapter.id} className="mb-12">
                  {/* Don't show heading for front/back matter */}
                  {!isSpecial && (
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: chapter.color }} />
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-400">
                        {getChapterLabel(chapter)}
                      </h2>
                    </div>
                  )}

                  {chScenes.map((scene, idx) => {
                    const sceneChars = scene.characterIds
                      .map((id) => characters.find((c) => c.id === id)?.name)
                      .filter(Boolean);
                    const scenePlace = scene.placeId ? places.find((p) => p.id === scene.placeId) : null;
                    const hasMetadata = sceneChars.length > 0 || scenePlace || scene.startDateTime;

                    return (
                    <div
                      key={scene.id}
                      ref={(el) => { sceneRefs.current[scene.id] = el; }}
                      id={`scene-${scene.id}`}
                      className={cn('mb-16', idx > 0 && 'border-t border-parchment-200 pt-12')}
                    >
                      {(scene.title || scene.description || hasMetadata) && (
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
                          {hasMetadata && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-300">
                              {sceneChars.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3 shrink-0" />
                                  {sceneChars.join(', ')}
                                </span>
                              )}
                              {scenePlace && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  {scenePlace.name}
                                </span>
                              )}
                              {scene.startDateTime && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 shrink-0" />
                                  {scene.startDateTime}{scene.endDateTime ? ` → ${scene.endDateTime}` : ''}
                                </span>
                              )}
                            </div>
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
                                {wc} / {scene.targetWordCount} {countUnitLabel(countUnit)}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    );
                  })}
                </div>
              );
            })}

            {sortedChapters.length === 0 && (
              <div className="text-center py-20 text-ink-200">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-display text-lg">Commencez par créer des chapitres et des scènes</p>
              </div>
            )}

            {/* Glossary section (read-only) */}
            {glossaryEntries.length > 0 && (
              <div ref={glossaryRef} className="mb-12 border-t-2 border-parchment-300 pt-12">
                <div className="flex items-center gap-3 mb-8">
                  <BookText className="w-5 h-5 text-ink-300 shrink-0" />
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-400">Glossaire</h2>
                </div>
                <div className="space-y-6">
                  {glossaryEntries.map((entry) => (
                    <div key={`${entry.type}-${entry.id}`} className="border-b border-parchment-200 pb-4 last:border-0">
                      <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">{entry.name}</h3>
                      {entry.description && (
                        <p className="text-sm text-ink-300 font-serif whitespace-pre-wrap leading-relaxed">{entry.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4ème de couverture */}
            {layout?.coverBack && (
              <div className="mb-12 border-t-2 border-parchment-300 pt-12 text-center">
                <img src={layout.coverBack} alt="4ème de couverture" className="max-h-72 mx-auto rounded-lg shadow-sm" />
                <p className="text-xs text-ink-200 mt-3">4ème de couverture</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Notes panel (right) ── */}
        <div
          className={cn(
            'hidden sm:flex flex-col shrink-0 border-l border-parchment-200 bg-parchment-50',
            'overflow-hidden transition-all duration-200 ease-in-out',
            notesOpen ? 'w-64' : 'w-0 border-l-0'
          )}
        >
          <div className="w-64 flex flex-col flex-1 min-h-0">
            {visibleSceneId && (
              <SelfCommentPanel
                sceneId={visibleSceneId}
                pendingSelection={pendingSelection}
                onClearSelection={() => setPendingSelection(null)}
                onHighlightComment={setActiveCommentId}
                activeCommentId={activeCommentId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
