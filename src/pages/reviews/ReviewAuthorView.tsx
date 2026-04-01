import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { BookText, ChevronDown, ChevronRight, ChevronLeft, Clock, PlayCircle, CheckCircle2, Lock, PanelLeft, MessageSquare, MessageSquarePlus, X, Menu, Archive, Send, Image } from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import { useAuthStore } from '@/store/useAuthStore';
import { ReviewCommentPanel } from '@/components/reviews/ReviewCommentPanel';
import { ReviewContentViewer } from '@/components/reviews/ReviewContentViewer';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn, isSpecialChapter, getChapterShortLabel, getChapterLabel } from '@/lib/utils';
import type { ReviewSnapshotScene } from '@/types';

const STATUS_CONFIG = {
  pending: { label: 'En attente', icon: Clock, color: 'text-amber-500' },
  in_progress: { label: 'En cours', icon: PlayCircle, color: 'text-blue-500' },
  completed: { label: 'Terminée', icon: CheckCircle2, color: 'text-green-500' },
  closed: { label: 'Clôturée', icon: Lock, color: 'text-ink-300' },
} as const;

export function ReviewAuthorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    currentSession,
    currentComments,
    isLoading,
    loadSession,
    addAuthorComment,
    updateComment,
    deleteComment,
    closeSession,
    sendAuthorComments,
  } = useReviewStore();

  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    sceneId: string;
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [isClosing, setIsClosing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Panel visibility
  const [navOpen, setNavOpen] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileCommentsOpen, setMobileCommentsOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadSession(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentSession?.snapshot.chapters) {
      setExpandedChapters(new Set(currentSession.snapshot.chapters.map((c) => c.id)));
    }
  }, [currentSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver to track which section is in view
  useEffect(() => {
    if (!scrollContainerRef.current || !currentSession) return;
    const container = scrollContainerRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId) setActiveSceneId(sectionId);
          }
        }
      },
      { root: container, rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    const timer = setTimeout(() => {
      container.querySelectorAll('[data-section-id]').forEach((el) => observer.observe(el));
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [currentSession]);

  const handleAddComment = useCallback(async (data: {
    sceneId: string;
    content: string;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    parentId?: string;
  }) => {
    if (!id || !user) return;
    await addAuthorComment(id, {
      sessionId: id,
      sceneId: data.sceneId,
      isAuthor: true,
      authorLabel: user.name,
      selectedText: data.selectedText,
      startOffset: data.startOffset,
      endOffset: data.endOffset,
      content: data.content,
      status: 'draft',
      parentId: data.parentId,
    });
    if (window.innerWidth < 1024) setMobileCommentsOpen(true);
  }, [id, user, addAuthorComment]);

  const handleUpdateComment = useCallback(async (commentId: string, data: { content?: string; status?: 'draft' | 'sent' | 'closed' }) => {
    if (!id) return;
    await updateComment(id, commentId, data);
  }, [id, updateComment]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!id) return;
    await deleteComment(id, commentId);
  }, [id, deleteComment]);

  const handleNavClick = useCallback((sectionId: string) => {
    setActiveSceneId(sectionId);
    const el = scrollContainerRef.current?.querySelector(`[data-section-id="${sectionId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileNavOpen(false);
  }, []);

  const handleCommentClick = useCallback((commentId: string | null) => {
    setActiveCommentId(commentId);
    if (commentId) {
      const comment = currentComments.find((c) => c.id === commentId);
      if (comment && comment.startOffset === -2) {
        // Chapter-level comment: find the chapter containing this scene and scroll to it
        const chapter = currentSession?.snapshot.chapters.find((ch) => ch.sceneIds.includes(comment.sceneId));
        if (chapter) {
          const el = scrollContainerRef.current?.querySelector(`[data-chapter-id="${chapter.id}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (comment && comment.startOffset === -1) {
        // Scene-level comment: scroll to the scene
        const el = scrollContainerRef.current?.querySelector(`[data-section-id="${comment.sceneId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setTimeout(() => {
          const mark = document.querySelector(`mark[data-comment-id="${commentId}"]`);
          if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    }
  }, [currentComments, currentSession]);

  const handleStructuralComment = useCallback((type: 'chapter' | 'scene', targetId: string, label: string) => {
    let sceneId: string;
    if (type === 'chapter') {
      const chapter = currentSession?.snapshot.chapters.find((ch) => ch.id === targetId);
      if (!chapter || chapter.sceneIds.length === 0) return;
      sceneId = chapter.sceneIds[0];
    } else {
      sceneId = targetId;
    }
    setPendingSelection({
      sceneId,
      text: label,
      startOffset: type === 'chapter' ? -2 : -1,
      endOffset: type === 'chapter' ? -2 : -1,
    });
    if (window.innerWidth < 1024) setMobileCommentsOpen(true);
  }, [currentSession]);

  const handleCloseSession = async () => {
    if (!id) return;
    setIsClosing(true);
    await closeSession(id);
    setIsClosing(false);
    setShowCloseConfirm(false);
  };

  const handleSendAuthorComments = async () => {
    if (!id) return;
    setIsSending(true);
    const count = await sendAuthorComments(id);
    setSentCount(count);
    setIsSending(false);
    setShowUnsavedConfirm(false);
    setTimeout(() => setSentCount(null), 3000);
  };

  // Compute before early return so useEffect can reference it
  const authorDraftCount = currentComments.filter((c) => c.status === 'draft' && c.isAuthor).length;

  // Block in-app navigation when there are unsent comments
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      authorDraftCount > 0 && currentLocation.pathname !== nextLocation.pathname
  );

  // Show the unsaved confirm dialog when blocker fires
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowUnsavedConfirm(true);
    }
  }, [blocker.state]);

  // Warn before page unload if there are unsent comments
  useEffect(() => {
    if (authorDraftCount > 0) {
      const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [authorDraftCount]);

  // Compute scene order and labels for continuous scroll comment panel
  const { sceneOrder, sceneLabels } = useMemo(() => {
    if (!currentSession) return { sceneOrder: [], sceneLabels: {} };
    const order: string[] = [];
    const labels: Record<string, string> = {};
    const sortedCh = [...currentSession.snapshot.chapters].sort((a, b) => a.number - b.number);
    for (const chapter of sortedCh) {
      const chapterScenes = chapter.sceneIds
        .map((sid) => currentSession.snapshot.scenes.find((s) => s.id === sid))
        .filter(Boolean) as ReviewSnapshotScene[];
      for (const scene of chapterScenes) {
        order.push(scene.id);
        const chLabel = isSpecialChapter(chapter) ? getChapterShortLabel(chapter) : getChapterLabel(chapter);
        labels[scene.id] = scene.title ? `${chLabel} — ${scene.title}` : chLabel;
      }
    }
    return { sceneOrder: order, sceneLabels: labels };
  }, [currentSession]);

  if (isLoading || !currentSession) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedChapters = [...currentSession.snapshot.chapters].sort((a, b) => a.number - b.number);
  const hasGlossary = (currentSession.snapshot.glossary?.length ?? 0) > 0;
  const hasCoverOrTitle = !!(currentSession.snapshot.layout?.coverFront || currentSession.bookTitle);
  const hasBackCover = !!currentSession.snapshot.layout?.coverBack;
  const statusConfig = STATUS_CONFIG[currentSession.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const sentComments = currentComments.filter((c) => c.status === 'sent' && !c.isAuthor && !c.parentId).length;
  const closedComments = currentComments.filter((c) => c.status === 'closed').length;
  const isClosed = currentSession.status === 'closed';
  const isClosable = currentSession.status === 'completed' || currentSession.status === 'in_progress';

  const handleBack = () => {
    if (authorDraftCount > 0) {
      setShowUnsavedConfirm(true);
    } else {
      navigate('/reviews');
    }
  };

  const handleConfirmLeave = () => {
    setShowUnsavedConfirm(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
    } else {
      navigate('/reviews');
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedConfirm(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const sceneCommentCounts = (sceneId: string) =>
    currentComments.filter((c) => c.sceneId === sceneId && !c.parentId).length;

  const navContent = (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-ink-200 uppercase tracking-wider">Plan</h3>
        <button onClick={() => { setNavOpen(false); setMobileNavOpen(false); }} className="p-1 rounded hover:bg-parchment-100 md:hidden">
          <X className="w-3.5 h-3.5 text-ink-300" />
        </button>
      </div>
      <div className="space-y-1">
        {/* Title page nav entry */}
        {hasCoverOrTitle && (
          <>
            <button
              onClick={() => handleNavClick('__titlepage__')}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors',
                activeSceneId === '__titlepage__' ? 'bg-bordeaux-100 text-bordeaux-600 font-medium' : 'text-ink-300 hover:bg-parchment-100'
              )}
            >
              <Image className="w-3 h-3" />
              <span>Page de titre</span>
            </button>
            <div className="border-t border-parchment-200 my-2" />
          </>
        )}

        {sortedChapters.map((chapter) => {
          const chapterScenes = chapter.sceneIds
            .map((sid) => currentSession.snapshot.scenes.find((s) => s.id === sid))
            .filter(Boolean) as ReviewSnapshotScene[];
          const isExpanded = expandedChapters.has(chapter.id);
          const isSpecial = isSpecialChapter(chapter);
          // Hide special chapters that have no scenes
          if (isSpecial && chapterScenes.length === 0) return null;
          return (
            <div key={chapter.id}>
              <button
                onClick={() => setExpandedChapters((prev) => { const n = new Set(prev); if (n.has(chapter.id)) n.delete(chapter.id); else n.add(chapter.id); return n; })}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-parchment-100 rounded"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3 text-ink-200" /> : <ChevronRight className="w-3 h-3 text-ink-200" />}
                {!isSpecial && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: chapter.color }} />}
                <span className={cn('font-medium truncate', isSpecial ? 'text-ink-300 italic' : 'text-ink-400')}>{getChapterShortLabel(chapter)}</span>
              </button>
              {isExpanded && (
                <div className="ml-5 space-y-0.5">
                  {chapterScenes.map((scene) => {
                    const count = sceneCommentCounts(scene.id);
                    return (
                      <button
                        key={scene.id}
                        onClick={() => handleNavClick(scene.id)}
                        className={cn(
                          'w-full text-left px-2 py-1 text-xs rounded truncate transition-colors flex items-center gap-1',
                          activeSceneId === scene.id ? 'bg-bordeaux-100 text-bordeaux-600 font-medium' : 'text-ink-300 hover:bg-parchment-100'
                        )}
                      >
                        <span className="truncate flex-1">{scene.title || scene.description || 'Scène sans titre'}</span>
                        {count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bordeaux-100 text-bordeaux-500 flex-shrink-0">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Glossary nav entry */}
        {hasGlossary && (
          <>
            <div className="border-t border-parchment-200 my-2" />
            <button
              onClick={() => handleNavClick('__glossary__')}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors',
                activeSceneId === '__glossary__' ? 'bg-bordeaux-100 text-bordeaux-600 font-medium' : 'text-ink-300 hover:bg-parchment-100'
              )}
            >
              <BookText className="w-3 h-3" />
              <span>Glossaire</span>
              <span className="ml-auto text-[10px] text-ink-200">{currentSession.snapshot.glossary!.length}</span>
            </button>
          </>
        )}

        {/* Back cover nav entry */}
        {hasBackCover && (
          <>
            <div className="border-t border-parchment-200 my-2" />
            <button
              onClick={() => handleNavClick('__backcover__')}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors',
                activeSceneId === '__backcover__' ? 'bg-bordeaux-100 text-bordeaux-600 font-medium' : 'text-ink-300 hover:bg-parchment-100'
              )}
            >
              <Image className="w-3 h-3" />
              <span>4ème de couverture</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Sub-header with session info */}
      <div className="border-b border-parchment-200 bg-parchment-50/50 px-4 py-2.5 flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-ink-300 hover:text-ink-500 transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Relectures</span>
        </button>
        <div className="w-px h-5 bg-parchment-300" />
        <button onClick={() => setMobileNavOpen(true)} className="p-1 rounded hover:bg-parchment-200 md:hidden" title="Plan">
          <Menu className="w-4 h-4 text-ink-400" />
        </button>
        <button onClick={() => setNavOpen((v) => !v)} className={cn('p-1 rounded hover:bg-parchment-200 hidden md:block', navOpen && 'text-bordeaux-500')} title={navOpen ? 'Masquer le plan' : 'Afficher le plan'}>
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-ink-500 text-sm truncate">{currentSession.bookTitle}</h2>
            <StatusIcon className={cn('w-4 h-4 flex-shrink-0', statusConfig.color)} />
            <span className={cn('text-xs flex-shrink-0 hidden sm:inline', statusConfig.color)}>{statusConfig.label}</span>
          </div>
          <p className="text-xs text-ink-300 truncate">
            Relecteur : <strong>{currentSession.readerName || currentSession.readerEmail || 'En attente'}</strong>
            {currentSession.readerName && currentSession.readerEmail && ` (${currentSession.readerEmail})`}
            {' · '}
            {sentComments} à traiter
            {closedComments > 0 && ` · ${closedComments} résolu${closedComments > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {authorDraftCount > 0 && (
            <button
              onClick={handleSendAuthorComments}
              disabled={isSending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bordeaux-500 text-white rounded-lg hover:bg-bordeaux-600 transition-colors disabled:opacity-50"
              title={`Envoyer ${authorDraftCount} réponse${authorDraftCount > 1 ? 's' : ''}`}
            >
              {isSending ? <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Envoyer ({authorDraftCount})</span>
              <span className="sm:hidden">{authorDraftCount}</span>
            </button>
          )}
          {sentCount !== null && sentCount > 0 && (
            <span className="text-xs text-green-600 font-medium px-2">{sentCount} envoyé{sentCount > 1 ? 's' : ''} !</span>
          )}
          {isClosable && (
            <button
              onClick={() => setShowCloseConfirm(true)}
              disabled={isClosing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-ink-200 text-ink-400 rounded-lg hover:bg-parchment-100 transition-colors disabled:opacity-50"
              title="Clôturer la relecture"
            >
              {isClosing ? <div className="w-3.5 h-3.5 border border-ink-300 border-t-transparent rounded-full animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Clôturer</span>
            </button>
          )}
          <button onClick={() => setMobileCommentsOpen(true)} className="p-1.5 rounded hover:bg-parchment-200 lg:hidden relative" title="Commentaires">
            <MessageSquare className="w-4 h-4 text-ink-400" />
            {sentComments > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] bg-blue-400 text-white rounded-full flex items-center justify-center">{sentComments}</span>}
          </button>
          <button onClick={() => setCommentsOpen((v) => !v)} className={cn('p-1.5 rounded hover:bg-parchment-200 hidden lg:block', commentsOpen && 'text-bordeaux-500')} title={commentsOpen ? 'Masquer les commentaires' : 'Commentaires'}>
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {mobileNavOpen && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setMobileNavOpen(false)} />}

        {/* Desktop nav */}
        <div className={cn('hidden md:flex flex-col flex-shrink-0 border-r border-parchment-200 bg-parchment-50 overflow-y-auto transition-all duration-200', navOpen ? 'w-56' : 'w-0 border-r-0 overflow-hidden')}>
          <div className="w-56 min-w-[14rem]">{navContent}</div>
        </div>

        {/* Mobile nav drawer */}
        <div className={cn('md:hidden fixed top-0 left-0 bottom-0 z-40 w-72 bg-parchment-50 shadow-xl border-r border-parchment-200 overflow-y-auto transition-transform duration-200', mobileNavOpen ? 'translate-x-0' : '-translate-x-full')}>
          {navContent}
        </div>

        {/* Center panel: Content — continuous scroll */}
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-32">
            {/* Title page */}
            {hasCoverOrTitle && (
              <div data-section-id="__titlepage__" className="mb-16 text-center">
                {currentSession.snapshot.layout?.coverFront && (
                  <img src={currentSession.snapshot.layout.coverFront} alt="1ère de couverture" className="max-h-80 mx-auto rounded-lg shadow-sm mb-8" />
                )}
                <h1 className="font-display text-3xl font-bold text-ink-500">{currentSession.bookTitle}</h1>
                {currentSession.snapshot.bookAuthor && <p className="text-lg text-ink-300 mt-2">{currentSession.snapshot.bookAuthor}</p>}
                <div className="border-b border-parchment-300 mt-12" />
              </div>
            )}

            {/* Chapters & scenes */}
            {sortedChapters.map((chapter) => {
              const chapterScenes = chapter.sceneIds
                .map((sid) => currentSession.snapshot.scenes.find((s) => s.id === sid))
                .filter(Boolean) as ReviewSnapshotScene[];
              const isSpecial = isSpecialChapter(chapter);
              if (isSpecial && chapterScenes.length === 0) return null;

              return (
                <div key={chapter.id} data-chapter-id={chapter.id} className="mb-12">
                  {/* Chapter heading */}
                  {!isSpecial && (
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: chapter.color }} />
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-400">
                        {getChapterLabel(chapter)}
                      </h2>
                      {!isClosed && (
                        <button
                          onClick={() => handleStructuralComment('chapter', chapter.id, getChapterLabel(chapter))}
                          className="p-1 rounded text-ink-200 hover:text-bordeaux-500 hover:bg-bordeaux-50 transition-colors"
                          title="Commenter ce chapitre"
                        >
                          <MessageSquarePlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Scenes */}
                  {chapterScenes.map((scene, idx) => (
                    <div
                      key={scene.id}
                      data-section-id={scene.id}
                      className={cn('mb-16', idx > 0 && 'border-t border-parchment-200 pt-12')}
                    >
                      {/* Scene title with comment icon */}
                      {scene.title && (
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-display text-lg font-bold text-ink-500">{scene.title}</h3>
                          {!isClosed && (
                            <button
                              onClick={() => handleStructuralComment('scene', scene.id, scene.title || 'Scène sans titre')}
                              className="p-1 rounded text-ink-200 hover:text-bordeaux-500 hover:bg-bordeaux-50 transition-colors"
                              title="Commenter cette scène"
                            >
                              <MessageSquarePlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}

                      <ReviewContentViewer
                        scene={scene}
                        comments={currentComments}
                        activeCommentId={activeCommentId}
                        onHoverComment={handleCommentClick}
                        onSelectText={isClosed ? undefined : (data) => setPendingSelection(data)}
                        layout={currentSession.snapshot.layout}
                        hideTitle
                      />
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Glossary */}
            {hasGlossary && (
              <div data-section-id="__glossary__" className="border-t-2 border-parchment-300 pt-12 mb-12">
                <h1 className="font-display text-2xl font-bold text-ink-500 mb-6">Glossaire</h1>
                <div className="space-y-4">
                  {currentSession.snapshot.glossary!.map((entry) => (
                    <div key={entry.id} className="border-b border-parchment-200 pb-4 last:border-0">
                      <h3 className="font-semibold text-ink-500 mb-1">{entry.name}</h3>
                      {entry.description && (
                        <p className="text-sm text-ink-300 whitespace-pre-wrap">{entry.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Back cover */}
            {hasBackCover && (
              <div data-section-id="__backcover__" className="border-t-2 border-parchment-300 pt-12 text-center">
                <img src={currentSession.snapshot.layout!.coverBack!} alt="4ème de couverture" className="max-h-96 mx-auto rounded-lg shadow-sm" />
                <p className="text-sm text-ink-200 mt-4">4ème de couverture</p>
              </div>
            )}
          </div>
        </div>

        {mobileCommentsOpen && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setMobileCommentsOpen(false)} />}

        {/* Desktop comments */}
        <div className={cn('hidden lg:flex flex-col flex-shrink-0 border-l border-parchment-200 bg-white overflow-hidden transition-all duration-200', commentsOpen ? 'w-80' : 'w-0 border-l-0')}>
          <div className="w-80 min-w-[20rem] flex flex-col h-full">
            <ReviewCommentPanel
              comments={currentComments}
              currentSceneId={activeSceneId}
              activeCommentId={activeCommentId}
              onHoverComment={handleCommentClick}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              userLabel={user?.name || 'Auteur'}
              isAuthor={true}
              pendingSelection={pendingSelection}
              onClearPendingSelection={() => setPendingSelection(null)}
              sceneOrder={sceneOrder}
              sceneLabels={sceneLabels}
            />
          </div>
        </div>

        {/* Mobile comments drawer */}
        <div className={cn('lg:hidden fixed top-0 right-0 bottom-0 z-40 w-80 max-w-[90vw] bg-white shadow-xl border-l border-parchment-200 flex flex-col transition-transform duration-200', mobileCommentsOpen ? 'translate-x-0' : 'translate-x-full')}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-parchment-200">
            <span className="text-sm font-medium text-ink-400">Commentaires</span>
            <button onClick={() => setMobileCommentsOpen(false)} className="p-1 rounded hover:bg-parchment-100"><X className="w-4 h-4 text-ink-300" /></button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ReviewCommentPanel
              comments={currentComments}
              currentSceneId={activeSceneId}
              activeCommentId={activeCommentId}
              onHoverComment={handleCommentClick}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              userLabel={user?.name || 'Auteur'}
              isAuthor={true}
              pendingSelection={pendingSelection}
              onClearPendingSelection={() => setPendingSelection(null)}
              sceneOrder={sceneOrder}
              sceneLabels={sceneLabels}
            />
          </div>
        </div>
      </div>

      {/* Unsent comments confirmation */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnsavedConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Réponses non envoyées</h3>
            <p className="text-sm text-ink-300 mb-6">
              Vous avez {authorDraftCount} réponse{authorDraftCount > 1 ? 's' : ''} en brouillon. Si vous quittez, elles ne seront pas envoyées au relecteur.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={handleCancelLeave} className="btn-secondary text-sm">
                Annuler
              </button>
              <button
                onClick={handleConfirmLeave}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-400 hover:bg-parchment-100 transition-colors"
              >
                Quitter
              </button>
              <button
                onClick={async () => { await handleSendAuthorComments(); if (blocker.state === 'blocked') blocker.proceed(); }}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Envoyer ({authorDraftCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close session confirmation */}
      {showCloseConfirm && (
        <ConfirmDialog
          open={true}
          title="Clôturer cette relecture"
          description={
            (() => {
              const parts: string[] = [];
              if (currentSession.status === 'in_progress') {
                parts.push("Le relecteur n'a pas encore indiqué avoir terminé sa relecture.");
              }
              const pending = currentComments.filter((c) => c.status === 'sent' && !c.isAuthor && !c.parentId).length;
              if (pending > 0) {
                parts.push(`${pending} commentaire${pending > 1 ? 's sont encore à traiter' : ' est encore à traiter'}.`);
              }
              parts.push('Une fois clôturée, la relecture ne sera plus accessible au relecteur.');
              return parts.join(' ');
            })()
          }
          confirmLabel="Clôturer"
          onConfirm={handleCloseSession}
          onCancel={() => setShowCloseConfirm(false)}
        />
      )}
    </div>
  );
}
