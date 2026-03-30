import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Feather, BookOpen, ChevronDown, ChevronRight, Send, CheckCircle2, LogIn, PanelLeft, MessageSquare, Lock, X, Menu } from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import { ReviewCommentPanel } from '@/components/reviews/ReviewCommentPanel';
import { ReviewContentViewer } from '@/components/reviews/ReviewContentViewer';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn, isSpecialChapter, getChapterShortLabel } from '@/lib/utils';
import type { ReviewSnapshotScene } from '@/types';

export function ReviewReaderPage() {
  const { token } = useParams<{ token: string }>();
  const {
    readerSession,
    readerComments,
    readerLoading,
    loadReaderSession,
    startReaderSession,
    loadReaderComments,
    addReaderComment,
    updateReaderComment,
    deleteReaderComment,
    sendReaderComments,
    completeReaderSession,
  } = useReviewStore();

  const [readerName, setReaderName] = useState('');
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    sceneId: string;
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Panel visibility
  const [navOpen, setNavOpen] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(true);
  // Mobile drawers
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileCommentsOpen, setMobileCommentsOpen] = useState(false);

  useEffect(() => {
    if (token) loadReaderSession(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (token && readerSession && readerSession.status !== 'pending') {
      loadReaderComments(token);
    }
  }, [token, readerSession?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (readerSession?.snapshot.chapters) {
      setExpandedChapters(new Set(readerSession.snapshot.chapters.map((c) => c.id)));
      if (readerSession.snapshot.scenes.length > 0 && !activeSceneId) {
        setActiveSceneId(readerSession.snapshot.scenes[0].id);
      }
    }
  }, [readerSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = async () => {
    if (!token || !readerName.trim()) return;
    await startReaderSession(token, readerName.trim());
  };

  const handleSend = async () => {
    if (!token) return;
    setIsSending(true);
    const count = await sendReaderComments(token);
    setSentCount(count);
    setIsSending(false);
    setTimeout(() => setSentCount(null), 3000);
  };

  const handleComplete = async () => {
    if (!token) return;
    // If there are unsent drafts, ask user first
    if (draftCount > 0 && !showCompleteConfirm) {
      setShowCompleteConfirm(true);
      return;
    }
    setShowCompleteConfirm(false);
    setIsCompleting(true);
    await sendReaderComments(token);
    await completeReaderSession(token);
    setIsCompleting(false);
  };

  const handleCompleteWithoutSending = async () => {
    if (!token) return;
    setShowCompleteConfirm(false);
    setIsCompleting(true);
    await completeReaderSession(token);
    setIsCompleting(false);
  };

  const handleAddComment = useCallback(async (data: {
    sceneId: string; content: string; selectedText: string;
    startOffset: number; endOffset: number; parentId?: string;
  }) => {
    if (!token || !readerSession) return;
    await addReaderComment(token, {
      sessionId: readerSession.id,
      sceneId: data.sceneId,
      isAuthor: false,
      authorLabel: readerSession.readerName || 'Relecteur',
      selectedText: data.selectedText,
      startOffset: data.startOffset,
      endOffset: data.endOffset,
      content: data.content,
      status: 'draft',
      parentId: data.parentId,
    });
    if (window.innerWidth < 1024) setMobileCommentsOpen(true);
  }, [token, readerSession, addReaderComment]);

  const handleUpdateComment = useCallback(async (commentId: string, data: { content?: string; status?: 'draft' | 'sent' | 'closed' }) => {
    if (!token) return;
    await updateReaderComment(token, commentId, data);
  }, [token, updateReaderComment]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!token) return;
    await deleteReaderComment(token, commentId);
  }, [token, deleteReaderComment]);

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

  const draftCount = readerComments.filter((c) => c.status === 'draft' && !c.isAuthor).length;
  const isCompleted = readerSession?.status === 'completed';

  // Warn before leaving with unsent drafts
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (draftCount > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draftCount]);

  if (readerLoading) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!readerSession) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
        <div className="text-center">
          <Feather className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-ink-400 mb-2">Session introuvable</h2>
          <p className="text-sm text-ink-300">Ce lien de relecture n'existe pas ou a été supprimé.</p>
        </div>
      </div>
    );
  }

  // Closed by author
  if (readerSession.status === 'closed') {
    return (
      <div className="min-h-screen bg-parchment-50">
        <header className="border-b border-parchment-300 bg-parchment-100/50 sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-bordeaux-500 rounded-lg flex items-center justify-center">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-ink-500 text-sm">{readerSession.bookTitle}</h1>
              <p className="text-xs text-ink-300">Relecture par {readerSession.readerName}</p>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center p-8">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-ink-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-ink-400" />
            </div>
            <h2 className="font-display text-xl font-bold text-ink-500 mb-2">Relecture clôturée</h2>
            <p className="text-sm text-ink-300">Cette relecture a été clôturée par l'auteur. Merci pour votre contribution !</p>
          </div>
        </div>
      </div>
    );
  }

  // Welcome screen (pending)
  if (readerSession.status === 'pending') {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-bordeaux-50 rounded-full flex items-center justify-center">
            <Feather className="w-8 h-8 text-bordeaux-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink-500 mb-2">Invitation à la relecture</h1>
          <p className="text-sm text-ink-300 mb-6">
            <strong>{readerSession.authorName}</strong> vous invite à relire des extraits de son livre
            <strong> « {readerSession.bookTitle} »</strong>.
          </p>
          <div className="bg-parchment-50 rounded-lg p-4 mb-6 text-left text-sm text-ink-300 space-y-2">
            <p>Vous pourrez :</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Lire les chapitres et scènes partagés</li>
              <li>Sélectionner du texte et ajouter des commentaires</li>
              <li>Envoyer vos commentaires quand vous êtes prêt</li>
              <li>Échanger avec l'auteur sur vos remarques</li>
            </ul>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-400 mb-1.5 text-left">Votre nom</label>
            <input
              type="text"
              value={readerName}
              onChange={(e) => setReaderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              placeholder="Comment voulez-vous être identifié ?"
              className="w-full px-3 py-2.5 text-sm border border-parchment-300 rounded-lg focus:border-bordeaux-300 focus:ring-1 focus:ring-bordeaux-200 outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={handleStart}
            disabled={!readerName.trim()}
            className={cn('btn-primary w-full flex items-center justify-center gap-2 py-3', !readerName.trim() && 'opacity-50 cursor-not-allowed')}
          >
            <LogIn className="w-4 h-4" />
            Commencer la relecture
          </button>
        </div>
      </div>
    );
  }

  // Main review interface (in_progress or completed)
  const sortedChapters = [...readerSession.snapshot.chapters].sort((a, b) => a.number - b.number);
  const activeScene = readerSession.snapshot.scenes.find((s) => s.id === activeSceneId) || null;

  const sceneCommentCounts = (sceneId: string) =>
    readerComments.filter((c) => c.sceneId === sceneId && !c.parentId).length;

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
            .map((sid) => readerSession.snapshot.scenes.find((s) => s.id === sid))
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
    <div className="h-screen flex flex-col bg-parchment-50">
      {/* Header */}
      <header className="border-b border-parchment-300 bg-parchment-100/50 flex-shrink-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="p-1.5 rounded hover:bg-parchment-200 md:hidden" title="Plan">
              <Menu className="w-4 h-4 text-ink-400" />
            </button>
            <button onClick={() => setNavOpen((v) => !v)} className={cn('p-1.5 rounded hover:bg-parchment-200 hidden md:block', navOpen && 'text-bordeaux-500')} title={navOpen ? 'Masquer le plan' : 'Afficher le plan'}>
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 bg-bordeaux-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-ink-500 text-sm truncate">{readerSession.bookTitle}</h1>
              <p className="text-xs text-ink-300 truncate">
                Relecture par <strong>{readerSession.readerName}</strong> · {readerSession.authorName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isCompleted && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 font-medium hidden sm:inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Terminée
              </span>
            )}
            <button onClick={() => setMobileCommentsOpen(true)} className="p-1.5 rounded hover:bg-parchment-200 lg:hidden relative" title="Commentaires">
              <MessageSquare className="w-4 h-4 text-ink-400" />
              {draftCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] bg-amber-400 text-white rounded-full flex items-center justify-center">{draftCount}</span>}
            </button>
            <button onClick={() => setCommentsOpen((v) => !v)} className={cn('p-1.5 rounded hover:bg-parchment-200 hidden lg:block', commentsOpen && 'text-bordeaux-500')} title={commentsOpen ? 'Masquer les commentaires' : 'Commentaires'}>
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {isCompleted && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-center gap-2 text-sm text-green-700 flex-shrink-0">
          <CheckCircle2 className="w-4 h-4" />
          <span className="hidden sm:inline">Vous avez marqué cette relecture comme terminée. L'auteur peut encore vous répondre.</span>
          <span className="sm:hidden">Relecture terminée</span>
        </div>
      )}

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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {activeScene ? (
              <ReviewContentViewer
                scene={activeScene}
                comments={readerComments}
                activeCommentId={activeCommentId}
                onHoverComment={handleCommentClick}
                onSelectText={isCompleted ? undefined : (data) => setPendingSelection(data)}
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
              comments={readerComments}
              currentSceneId={activeSceneId}
              activeCommentId={activeCommentId}
              onHoverComment={handleCommentClick}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              userLabel={readerSession.readerName || 'Relecteur'}
              isAuthor={false}
              pendingSelection={pendingSelection}
              onClearPendingSelection={() => setPendingSelection(null)}
              readOnly={isCompleted}
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
              comments={readerComments}
              currentSceneId={activeSceneId}
              activeCommentId={activeCommentId}
              onHoverComment={handleCommentClick}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              userLabel={readerSession.readerName || 'Relecteur'}
              isAuthor={false}
              pendingSelection={pendingSelection}
              onClearPendingSelection={() => setPendingSelection(null)}
              readOnly={isCompleted}
            />
          </div>
        </div>
      </div>

      {/* Bottom bar — only when not completed */}
      {!isCompleted && (
        <div className="border-t border-parchment-300 bg-white px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-ink-300">
            {draftCount > 0 ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {draftCount} brouillon{draftCount > 1 ? 's' : ''}
              </span>
            ) : sentCount !== null ? (
              <span className="text-green-500">{sentCount} envoyé{sentCount > 1 ? 's' : ''} !</span>
            ) : (
              <span className="text-ink-200 hidden sm:inline">Sélectionnez du texte pour commenter</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {draftCount > 0 && (
              <button onClick={handleSend} disabled={isSending} className="btn-primary flex items-center gap-1.5 px-4 py-1.5 text-sm">
                {isSending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Envoyer ({draftCount})
              </button>
            )}
            <button onClick={handleComplete} disabled={isCompleting} className="flex items-center gap-1.5 px-4 py-1.5 text-sm border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50">
              {isCompleting ? <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Terminer la relecture</span>
              <span className="sm:hidden">Terminer</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirm complete with unsent drafts */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Commentaires non envoyés</h3>
            <p className="text-sm text-ink-300 mb-6">
              Vous avez {draftCount} commentaire{draftCount > 1 ? 's' : ''} en brouillon. Que souhaitez-vous faire ?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowCompleteConfirm(false)}
                className="w-full px-4 py-2.5 text-sm border border-parchment-300 rounded-lg hover:bg-parchment-50 transition-colors text-ink-400"
              >
                Annuler
              </button>
              <button
                onClick={handleCompleteWithoutSending}
                className="w-full px-4 py-2.5 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              >
                Terminer sans envoyer
              </button>
              <button
                onClick={handleComplete}
                className="w-full px-4 py-2.5 text-sm bg-bordeaux-500 text-white rounded-lg hover:bg-bordeaux-600 transition-colors font-medium"
              >
                Envoyer et terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
