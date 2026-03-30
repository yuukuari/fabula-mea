import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Feather, BookOpen, ChevronDown, ChevronRight, ChevronLeft, Clock, PlayCircle, CheckCircle2, Lock, PanelLeft, MessageSquare, X, Menu, Archive, Send } from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import { useAuthStore } from '@/store/useAuthStore';
import { ReviewCommentPanel } from '@/components/reviews/ReviewCommentPanel';
import { ReviewContentViewer } from '@/components/reviews/ReviewContentViewer';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
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

  useEffect(() => {
    if (id) loadSession(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentSession?.snapshot.chapters) {
      setExpandedChapters(new Set(currentSession.snapshot.chapters.map((c) => c.id)));
      if (currentSession.snapshot.scenes.length > 0 && !activeSceneId) {
        setActiveSceneId(currentSession.snapshot.scenes[0].id);
      }
    }
  }, [currentSession]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSceneSelect = useCallback((sceneId: string) => {
    setActiveSceneId(sceneId);
    setMobileNavOpen(false);
  }, []);

  const handleCommentClick = useCallback((commentId: string | null) => {
    setActiveCommentId(commentId);
    if (commentId) {
      setTimeout(() => {
        const mark = document.querySelector(`mark[data-comment-id="${commentId}"]`);
        if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, []);

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

  if (isLoading || !currentSession) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedChapters = [...currentSession.snapshot.chapters].sort((a, b) => a.number - b.number);
  const activeScene = currentSession.snapshot.scenes.find((s) => s.id === activeSceneId) || null;
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
        {sortedChapters.map((chapter) => {
          const chapterScenes = chapter.sceneIds
            .map((sid) => currentSession.snapshot.scenes.find((s) => s.id === sid))
            .filter(Boolean) as ReviewSnapshotScene[];
          const isExpanded = expandedChapters.has(chapter.id);
          return (
            <div key={chapter.id}>
              <button
                onClick={() => setExpandedChapters((prev) => { const n = new Set(prev); if (n.has(chapter.id)) n.delete(chapter.id); else n.add(chapter.id); return n; })}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-parchment-100 rounded"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3 text-ink-200" /> : <ChevronRight className="w-3 h-3 text-ink-200" />}
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: chapter.color }} />
                <span className="text-ink-400 font-medium truncate">Ch. {chapter.number}{chapter.title ? ` — ${chapter.title}` : ''}</span>
              </button>
              {isExpanded && (
                <div className="ml-5 space-y-0.5">
                  {chapterScenes.map((scene) => {
                    const count = sceneCommentCounts(scene.id);
                    return (
                      <button
                        key={scene.id}
                        onClick={() => handleSceneSelect(scene.id)}
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

        {/* Center panel: Content viewer */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {activeScene ? (
              <ReviewContentViewer
                scene={activeScene}
                comments={currentComments}
                activeCommentId={activeCommentId}
                onHoverComment={handleCommentClick}
                onSelectText={isClosed ? undefined : (data) => setPendingSelection(data)}
              />
            ) : (
              <div className="text-center py-20">
                <BookOpen className="w-12 h-12 text-ink-200 mx-auto mb-4" />
                <p className="text-ink-300">Sélectionnez une scène dans le plan.</p>
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
