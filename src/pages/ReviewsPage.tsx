import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2, Clock, CheckCircle2, PlayCircle, Copy, Check, Mail, BookOpen, Lock, MessageSquare, Archive } from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import { useBookStore } from '@/store/useBookStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
import type { ReviewSession } from '@/types';
import { NewReviewDialog } from '@/components/reviews/NewReviewDialog';

const STATUS_CONFIG: Record<ReviewSession['status'], { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending: { label: 'En attente', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
  in_progress: { label: 'En cours', icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
  completed: { label: 'Terminée', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
  closed: { label: 'Clôturée', icon: Lock, color: 'text-ink-300', bg: 'bg-ink-50' },
};

export function ReviewsPage() {
  const navigate = useNavigate();
  const { sessions, isLoading, loadSessions, deleteSession, closeSession } = useReviewStore();
  const user = useAuthStore((s) => s.user);
  const books = useLibraryStore((s) => s.books);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<Set<ReviewSession['status']>>(
    new Set(['pending', 'in_progress', 'completed'])
  );

  const toggleStatus = (status: ReviewSession['status']) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  useEffect(() => {
    loadSessions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/review/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSession(deleteTarget);
    setDeleteTarget(null);
  };

  const handleClose = async () => {
    if (!closeTarget) return;
    setClosingId(closeTarget);
    await closeSession(closeTarget);
    setClosingId(null);
    setCloseTarget(null);
  };

  const closeTargetSession = closeTarget ? sessions.find((s) => s.id === closeTarget) : null;
  const closeTargetPending = closeTargetSession?.pendingCommentsCount ?? 0;

  const sortedSessions = [...sessions]
    .filter((s) => activeStatuses.has(s.status))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page-container max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Relectures</h2>
        <button
          onClick={() => setShowNewDialog(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle relecture</span>
        </button>
      </div>

      {/* Status filters */}
      {sessions.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {(Object.entries(STATUS_CONFIG) as [ReviewSession['status'], typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([status, config]) => {
            const count = sessions.filter((s) => s.status === status).length;
            const isActive = activeStatuses.has(status);
            const StatusIcon = config.icon;
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  isActive
                    ? `${config.bg} ${config.color} border-current`
                    : 'bg-parchment-100 text-ink-200 border-parchment-200 hover:bg-parchment-200'
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {config.label}
                {count > 0 && <span className="ml-0.5">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucune relecture"
          description="Créez une demande de relecture pour partager vos chapitres avec un lecteur extérieur et recueillir ses commentaires."
          action={
            <button onClick={() => setShowNewDialog(true)} className="btn-primary">
              Créer une relecture
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSessions.map((session) => {
            const config = STATUS_CONFIG[session.status];
            const StatusIcon = config.icon;
            const scenesCount = session.snapshot.scenes.length;
            const chaptersCount = session.snapshot.chapters.length;
            const readerLabel = session.readerName || session.readerEmail || 'Relecteur en attente';

            return (
              <div
                key={session.id}
                className={cn(
                  'card-fantasy p-4 flex flex-col gap-3 hover:shadow-md transition-shadow',
                  session.status === 'closed' && 'opacity-70'
                )}
              >
                {/* Top: title + status */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display font-bold text-ink-500 text-sm truncate flex-1">
                      {session.bookTitle}
                    </h3>
                    <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', config.color, config.bg)}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-ink-400 truncate">{readerLabel}</p>
                  {session.readerName && session.readerEmail && (
                    <p className="text-xs text-ink-200 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />
                      {session.readerEmail}
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-300">
                  <span>{formatDate(session.createdAt)}</span>
                  <span>{chaptersCount} chap. · {scenesCount} scène{scenesCount > 1 ? 's' : ''}</span>
                </div>

                {/* Comment counts */}
                {session.commentsCount > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
                      <MessageSquare className="w-3 h-3" />
                      <span>Commentaires</span>
                    </div>
                    {session.status === 'closed' ? (
                      <div className="text-xs pl-[18px] space-y-0.5">
                        <p className="text-ink-400">{session.commentsCount - (session.pendingCommentsCount ?? 0)} traité{(session.commentsCount - (session.pendingCommentsCount ?? 0)) > 1 ? 's' : ''}</p>
                        <p className="text-ink-300">{session.commentsCount} au total</p>
                      </div>
                    ) : (session.pendingCommentsCount ?? 0) > 0 ? (
                      <div className="text-xs pl-[18px] space-y-0.5">
                        <p className="font-semibold text-bordeaux-500">{session.pendingCommentsCount} à traiter</p>
                        <p className="text-ink-300">{session.commentsCount} au total</p>
                      </div>
                    ) : (
                      <div className="text-xs pl-[18px] space-y-0.5">
                        <p className="text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Tous traités</p>
                        <p className="text-ink-300">{session.commentsCount} au total</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 mt-auto pt-2 border-t border-parchment-100">
                  <button
                    onClick={() => handleCopyLink(session.token)}
                    className="btn-ghost p-1.5 text-xs flex items-center gap-1"
                    title="Copier le lien"
                  >
                    {copiedToken === session.token ? (
                      <><Check className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">Copié</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Lien</span></>
                    )}
                  </button>

                  <button
                    onClick={() => navigate(`/reviews/${session.id}`)}
                    className="btn-ghost p-1.5 text-xs flex items-center gap-1"
                    title="Voir la relecture"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Voir</span>
                  </button>

                  {(session.status === 'completed' || session.status === 'in_progress') && (
                    <button
                      onClick={() => setCloseTarget(session.id)}
                      disabled={closingId === session.id}
                      className="btn-ghost p-1.5 text-xs flex items-center gap-1 text-ink-300 hover:text-ink-500"
                      title="Clôturer la relecture"
                    >
                      {closingId === session.id ? (
                        <div className="w-3.5 h-3.5 border border-ink-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Clôturer</span>
                    </button>
                  )}

                  <div className="flex-1" />
                  <button
                    onClick={() => setDeleteTarget(session.id)}
                    className="btn-ghost p-1.5 text-red-400 hover:text-red-500"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewDialog && (
        <NewReviewDialog
          onClose={() => setShowNewDialog(false)}
          onCreated={(session) => {
            setShowNewDialog(false);
            handleCopyLink(session.token);
          }}
          onMultiCreated={(sessions) => {
            setShowNewDialog(false);
            loadSessions();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer cette relecture"
        description="Cette action est irréversible. Tous les commentaires associés seront perdus."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!closeTarget}
        title="Clôturer cette relecture"
        description={
          (() => {
            const parts: string[] = [];
            if (closeTargetSession?.status === 'in_progress') {
              parts.push('Le relecteur n\'a pas encore indiqué avoir terminé sa relecture.');
            }
            if (closeTargetPending > 0) {
              parts.push(`${closeTargetPending} commentaire${closeTargetPending > 1 ? 's sont encore à traiter' : ' est encore à traiter'}.`);
            }
            parts.push('Une fois clôturée, la relecture ne sera plus accessible au relecteur.');
            return parts.join(' ');
          })()
        }
        confirmLabel="Clôturer"
        onConfirm={handleClose}
        onCancel={() => setCloseTarget(null)}
      />
    </div>
  );
}
