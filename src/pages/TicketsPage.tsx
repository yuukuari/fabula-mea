import { useEffect, useState, useRef } from 'react';
import {
  Bug, HelpCircle, Sparkles, Eye, EyeOff, Clock, CheckCircle, Copy,
  Trash2, ChevronLeft, Send, MessageSquare, Tag, SmilePlus, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTicketStore } from '@/store/useTicketStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useReleaseStore } from '@/store/useReleaseStore';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { Ticket, TicketType, TicketStatus, TicketComment, TicketStatusChange } from '@/types';

const TYPE_CONFIG: Record<TicketType, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'bg-red-100 text-red-700' },
  question: { icon: HelpCircle, label: 'Question', color: 'bg-blue-100 text-blue-700' },
  improvement: { icon: Sparkles, label: 'Amélioration', color: 'bg-green-100 text-green-700' },
};

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Ouvert', color: 'bg-amber-100 text-amber-700', icon: Clock },
  closed_done: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed_duplicate: { label: 'Dupliqué', color: 'bg-gray-100 text-gray-600', icon: Copy },
};

const QUICK_REACTIONS = ['👍', '👎', '❤️', '🎉', '😕', '🔥'];

export function TicketsPage() {
  const { tickets, statusChanges, loadTickets, isLoading } = useTicketStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TicketType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    loadTickets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = tickets
    .filter((t) => filter === 'all' || t.type === filter)
    .filter((t) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'open') return t.status === 'open';
      return t.status !== 'open';
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (selectedId) {
    return <TicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title">Tickets</h1>
        <span className="text-sm text-ink-200">{filtered.length} ticket{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 bg-parchment-100 rounded-lg p-1">
          {[
            { value: 'all' as const, label: 'Tous' },
            { value: 'bug' as const, label: '🐛 Bugs' },
            { value: 'question' as const, label: '❓ Questions' },
            { value: 'improvement' as const, label: '✨ Améliorations' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                filter === f.value ? 'bg-white shadow-sm text-ink-500 font-medium' : 'text-ink-300 hover:text-ink-400'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-parchment-100 rounded-lg p-1">
          {[
            { value: 'all' as const, label: 'Tous statuts' },
            { value: 'open' as const, label: 'Ouverts' },
            { value: 'closed' as const, label: 'Fermés' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                statusFilter === f.value ? 'bg-white shadow-sm text-ink-500 font-medium' : 'text-ink-300 hover:text-ink-400'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-ink-200">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun ticket pour le moment</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onClick={() => setSelectedId(ticket.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const typeConf = TYPE_CONFIG[ticket.type];
  const statusConf = STATUS_CONFIG[ticket.status];
  const TypeIcon = typeConf.icon;

  return (
    <button
      onClick={onClick}
      className="w-full card-fantasy p-4 text-left flex items-start gap-4 group"
    >
      <div className={cn('badge', typeConf.color)}>
        <TypeIcon className="w-3.5 h-3.5 mr-1" />
        {typeConf.label}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-ink-500 group-hover:text-bordeaux-500 transition-colors truncate">
          {ticket.title}
        </h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-ink-200">
          <span>{ticket.userName}</span>
          <span>•</span>
          <span>{new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</span>
          {ticket.visibility === 'private' && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Privé</span>
            </>
          )}
        </div>
      </div>
      <div className={cn('badge', statusConf.color)}>
        {statusConf.label}
      </div>
    </button>
  );
}

// ─── Ticket Detail View ──────────────────────────────────────────────────────

function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const {
    currentTicket: ticket, currentComments: comments, currentStatusChanges: statusChanges,
    loadTicket, updateTicket, deleteTicket, addComment, deleteComment, addReaction,
  } = useTicketStore();
  const releases = useReleaseStore((s) => s.releases);
  const loadReleases = useReleaseStore((s) => s.loadReleases);

  const [newComment, setNewComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.isAdmin ?? false;
  const isOwner = user?.id === ticket?.userId;

  useEffect(() => {
    loadTicket(ticketId);
    loadReleases();
  }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) {
        setShowReactions(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!ticket) {
    return (
      <div className="page-container">
        <button onClick={onBack} className="btn-ghost flex items-center gap-2 mb-4">
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const typeConf = TYPE_CONFIG[ticket.type];
  const statusConf = STATUS_CONFIG[ticket.status];
  const TypeIcon = typeConf.icon;

  // Merge comments and status changes into a timeline sorted by date
  const timeline: Array<
    | { kind: 'comment'; data: TicketComment; date: string }
    | { kind: 'status'; data: TicketStatusChange; date: string }
  > = [
    ...comments.map((c) => ({ kind: 'comment' as const, data: c, date: c.createdAt })),
    ...statusChanges.map((s) => ({ kind: 'status' as const, data: s, date: s.createdAt })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleStatusChange = async (status: TicketStatus) => {
    await updateTicket(ticketId, { status });
  };

  const handleReleaseAssign = async (releaseId: string) => {
    await updateTicket(ticketId, { releaseId: releaseId || undefined });
  };

  const handleDelete = async () => {
    await deleteTicket(ticketId);
    onBack();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment(ticketId, newComment.trim());
    setNewComment('');
  };

  return (
    <div className="page-container max-w-4xl">
      <button onClick={onBack} className="btn-ghost flex items-center gap-2 mb-4">
        <ChevronLeft className="w-4 h-4" /> Retour aux tickets
      </button>

      {/* Ticket header */}
      <div className="card-fantasy p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('badge', typeConf.color)}>
                <TypeIcon className="w-3.5 h-3.5 mr-1" />
                {typeConf.label}
              </span>
              <span className={cn('badge', statusConf.color)}>
                {statusConf.label}
              </span>
              {ticket.visibility === 'private' && (
                <span className="badge bg-gray-100 text-gray-500">
                  <EyeOff className="w-3 h-3 mr-1" /> Privé
                </span>
              )}
            </div>
            <h1 className="text-xl font-display font-bold text-ink-500">{ticket.title}</h1>
            <p className="text-sm text-ink-200 mt-1">
              Par <span className="font-medium text-ink-400">{ticket.userName}</span> le{' '}
              {new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {ticket.status === 'open' && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleStatusChange('closed_done')}
                    className="btn-ghost text-xs flex items-center gap-1 text-green-600 hover:bg-green-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Terminé
                  </button>
                  <button
                    onClick={() => handleStatusChange('closed_duplicate')}
                    className="btn-ghost text-xs flex items-center gap-1 text-gray-500 hover:bg-gray-100"
                  >
                    <Copy className="w-3.5 h-3.5" /> Dupliqué
                  </button>
                </div>
              )}
              {ticket.status !== 'open' && (
                <button
                  onClick={() => handleStatusChange('open')}
                  className="btn-ghost text-xs flex items-center gap-1 text-amber-600 hover:bg-amber-50"
                >
                  <Clock className="w-3.5 h-3.5" /> Rouvrir
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="btn-ghost text-xs text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Release assignment (admin) */}
        {isAdmin && (
          <div className="flex items-center gap-2 pt-3 border-t border-parchment-200">
            <Tag className="w-4 h-4 text-ink-200" />
            <span className="text-sm text-ink-300">Release :</span>
            <select
              value={ticket.releaseId ?? ''}
              onChange={(e) => handleReleaseAssign(e.target.value)}
              className="text-sm border border-parchment-300 rounded px-2 py-1 bg-white"
            >
              <option value="">Aucune</option>
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  v{r.version} — {r.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Description */}
        <div
          className="prose prose-sm max-w-none mt-4 pt-4 border-t border-parchment-200"
          dangerouslySetInnerHTML={{ __html: ticket.description }}
        />
      </div>

      {/* Timeline (comments + status changes) */}
      <div className="space-y-3 mb-6">
        <h2 className="text-sm font-medium text-ink-400 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Activité ({timeline.length})
        </h2>

        {timeline.length === 0 && (
          <p className="text-sm text-ink-200 py-4 text-center">Aucune activité pour le moment</p>
        )}

        {timeline.map((entry) => {
          if (entry.kind === 'status') {
            const sc = entry.data;
            const fromConf = STATUS_CONFIG[sc.fromStatus];
            const toConf = STATUS_CONFIG[sc.toStatus];
            return (
              <div
                key={sc.id}
                className="flex items-center gap-2 px-4 py-2 bg-parchment-50 rounded-lg text-xs text-ink-300 border border-parchment-200"
              >
                <span className="font-medium">{sc.userName}</span>
                a changé le statut de
                <span className={cn('badge text-[10px]', fromConf.color)}>{fromConf.label}</span>
                vers
                <span className={cn('badge text-[10px]', toConf.color)}>{toConf.label}</span>
                <span className="ml-auto text-ink-200">
                  {new Date(sc.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
            );
          }

          const comment = entry.data;
          const isOwnComment = comment.userId === user?.id;
          return (
            <div key={comment.id} className="card-fantasy p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium',
                    comment.isAdmin ? 'text-bordeaux-500' : 'text-ink-400'
                  )}>
                    {comment.userName}
                    {comment.isAdmin && (
                      <span className="ml-1 badge bg-bordeaux-100 text-bordeaux-600 text-[10px]">Admin</span>
                    )}
                  </span>
                  <span className="text-xs text-ink-200">
                    {new Date(comment.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Reaction button */}
                  <div className="relative" ref={showReactions === comment.id ? reactionsRef : undefined}>
                    <button
                      onClick={() => setShowReactions(showReactions === comment.id ? null : comment.id)}
                      className="p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-100"
                      title="Ajouter une réaction"
                    >
                      <SmilePlus className="w-3.5 h-3.5" />
                    </button>
                    {showReactions === comment.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-parchment-300 p-2 flex gap-1 z-20">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              addReaction(ticketId, comment.id, emoji);
                              setShowReactions(null);
                            }}
                            className="w-8 h-8 rounded hover:bg-parchment-100 flex items-center justify-center text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Delete (own comment or admin) */}
                  {(isOwnComment || isAdmin) && (
                    <button
                      onClick={() => deleteComment(ticketId, comment.id)}
                      className="p-1 rounded text-ink-200 hover:text-red-500 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-ink-400 whitespace-pre-wrap">{comment.content}</p>
              {/* Reactions */}
              {Object.keys(comment.reactions).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(comment.reactions).map(([emoji, userIds]) => (
                    <button
                      key={emoji}
                      onClick={() => addReaction(ticketId, comment.id, emoji)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                        userIds.includes(user?.id ?? '')
                          ? 'bg-bordeaux-50 border-bordeaux-200 text-bordeaux-600'
                          : 'bg-parchment-50 border-parchment-200 text-ink-300 hover:border-parchment-400'
                      )}
                    >
                      <span>{emoji}</span>
                      <span>{userIds.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add comment (admin only for now) */}
      {isAdmin && (
        <div className="card-fantasy p-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            className="textarea-field text-sm"
            rows={3}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Commenter
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer le ticket ?"
        description="Cette action est irréversible. Le ticket et tous ses commentaires seront supprimés."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
