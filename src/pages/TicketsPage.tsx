import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Bug, HelpCircle, Sparkles, Eye, EyeOff, Clock, CheckCircle, Copy,
  Trash2, ChevronLeft, Send, MessageSquare, Tag, SmilePlus, X, ExternalLink,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Heading3, Quote, List, ListOrdered,
  ImagePlus, Link as LinkIcon, Unlink, RemoveFormatting,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { cn } from '@/lib/utils';
import { useTicketStore } from '@/store/useTicketStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useReleaseStore } from '@/store/useReleaseStore';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useNavigate } from 'react-router-dom';
import type { Ticket, TicketType, TicketStatus, TicketModule, TicketComment, TicketStatusChange } from '@/types';

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

const MODULE_LABELS: Record<string, string> = {
  auth: 'Login / Inscription',
  characters: 'Personnages',
  places: 'Lieux',
  chapters: 'Chapitres / Scènes',
  timeline: 'Timeline',
  progress: 'Progression',
  world: 'Worldbuilding',
  maps: 'Cartes',
  notes: 'Notes & Idées',
  reviews: 'Relectures',
  settings: 'Paramètres',
  export: 'Export',
  other: 'Autre',
};

const QUICK_REACTIONS = ['👍', '👎', '❤️', '🎉', '😕', '🔥'];

export function TicketsPage() {
  const { tickets, statusChanges, loadTickets, isLoading } = useTicketStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TicketType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [moduleFilter, setModuleFilter] = useState<'all' | TicketModule>('all');

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
    .filter((t) => {
      if (moduleFilter === 'all') return true;
      return t.module === moduleFilter;
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
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value as 'all' | TicketModule)}
          className="text-sm border border-parchment-300 rounded-lg px-3 py-1.5 bg-white text-ink-400"
        >
          <option value="all">Toutes sections</option>
          {Object.entries(MODULE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
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
          {ticket.module && MODULE_LABELS[ticket.module] && (
            <>
              <span>•</span>
              <span className="badge bg-purple-50 text-purple-600 text-[10px] py-0 px-1.5">{MODULE_LABELS[ticket.module]}</span>
            </>
          )}
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
  const navigate = useNavigate();
  const {
    currentTicket: ticket, currentComments: comments, currentStatusChanges: statusChanges,
    loadTicket, updateTicket, deleteTicket, addComment, deleteComment, addReaction,
  } = useTicketStore();
  const releases = useReleaseStore((s) => s.releases);
  const loadReleases = useReleaseStore((s) => s.loadReleases);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);

  const [isCommentEmpty, setIsCommentEmpty] = useState(true);

  const commentEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Ajouter un commentaire...' }),
      Link.configure({ openOnClick: false }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4 mx-auto block',
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor: e }) => {
      setIsCommentEmpty(e.isEmpty);
    },
  });

  const addImage = useCallback(() => {
    if (!commentEditor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          commentEditor.chain().focus().setImage({ src: reader.result }).run();
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [commentEditor]);

  const toggleLink = useCallback(() => {
    if (!commentEditor) return;
    if (commentEditor.isActive('link')) {
      commentEditor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL du lien :');
    if (url) {
      commentEditor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [commentEditor]);

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
    if (!commentEditor || commentEditor.isEmpty) return;
    await addComment(ticketId, commentEditor.getHTML());
    commentEditor.commands.setContent('');
    setIsCommentEmpty(true);
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
              {ticket.module && MODULE_LABELS[ticket.module] && (
                <span className="badge bg-purple-50 text-purple-600">
                  {MODULE_LABELS[ticket.module]}
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

        {/* Release assignment (admin) / display (user) */}
        {isAdmin ? (
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
                  v{r.version}{r.title ? ` — ${r.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : ticket.releaseId ? (
          <div className="flex items-center gap-2 pt-3 border-t border-parchment-200">
            <Tag className="w-4 h-4 text-ink-200" />
            <span className="text-sm text-ink-300">Release :</span>
            {(() => {
              const rel = releases.find((r) => r.id === ticket.releaseId);
              return rel ? (
                <button
                  onClick={() => navigate('/releases')}
                  className="text-sm text-bordeaux-500 hover:underline flex items-center gap-1"
                >
                  v{rel.version}{rel.title ? ` — ${rel.title}` : ''}
                  <ExternalLink className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-sm text-ink-300">Inconnue</span>
              );
            })()}
          </div>
        ) : null}

        {/* Description */}
        <div
          className="prose prose-sm max-w-none mt-4 pt-4 border-t border-parchment-200"
          dangerouslySetInnerHTML={{ __html: ticket.description }}
        />

        {/* Reactions on description */}
        <div className="flex items-center gap-2 mt-3">
          <div className="relative" ref={showReactions === '__desc__' ? reactionsRef : undefined}>
            <button
              onClick={() => setShowReactions(showReactions === '__desc__' ? null : '__desc__')}
              className="p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-100"
              title="Ajouter une réaction"
            >
              <SmilePlus className="w-4 h-4" />
            </button>
            {showReactions === '__desc__' && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-parchment-300 p-2 flex gap-1 z-20">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      addReaction(ticketId, '__desc__', emoji);
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
          {ticket.reactions && Object.keys(ticket.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(ticket.reactions).map(([emoji, userIds]) => (
                <button
                  key={emoji}
                  onClick={() => addReaction(ticketId, '__desc__', emoji)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                    (userIds as string[]).includes(user?.id ?? '')
                      ? 'bg-bordeaux-50 border-bordeaux-200 text-bordeaux-600'
                      : 'bg-parchment-50 border-parchment-200 text-ink-300 hover:border-parchment-400'
                  )}
                >
                  <span>{emoji}</span>
                  <span>{(userIds as string[]).length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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

            // Release assignment activity
            if (sc.type === 'release_assign') {
              return (
                <div
                  key={sc.id}
                  className="flex items-center gap-2 px-4 py-2 bg-parchment-50 rounded-lg text-xs text-ink-300 border border-parchment-200"
                >
                  <Tag className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="font-medium">{sc.userName}</span>
                  {sc.releaseId
                    ? <>
                        a planifié ce ticket dans la release
                        <span className="badge bg-blue-100 text-blue-700 text-[10px]">{sc.releaseName || sc.releaseId}</span>
                      </>
                    : <>a retiré ce ticket de sa release</>}
                  <span className="ml-auto text-ink-200">
                    {new Date(sc.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              );
            }

            // Status change activity
            const fromConf = sc.fromStatus ? STATUS_CONFIG[sc.fromStatus] : null;
            const toConf = sc.toStatus ? STATUS_CONFIG[sc.toStatus] : null;
            return (
              <div
                key={sc.id}
                className="flex items-center gap-2 px-4 py-2 bg-parchment-50 rounded-lg text-xs text-ink-300 border border-parchment-200"
              >
                <span className="font-medium">{sc.userName}</span>
                a changé le statut de
                {fromConf && <span className={cn('badge text-[10px]', fromConf.color)}>{fromConf.label}</span>}
                vers
                {toConf && <span className={cn('badge text-[10px]', toConf.color)}>{toConf.label}</span>}
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
                  {/* Delete (own comment or admin) — with confirmation for admin */}
                  {(isOwnComment || isAdmin) && (
                    <button
                      onClick={() => setConfirmDeleteCommentId(comment.id)}
                      className="p-1 rounded text-ink-200 hover:text-red-500 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-ink-400" dangerouslySetInnerHTML={{ __html: comment.content }} />
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

      {/* Add comment */}
      <div className="card-fantasy p-4">
        <div className="border border-parchment-300 rounded-lg overflow-hidden">
          {commentEditor && (
            <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-parchment-200 bg-parchment-50">
              <MiniToolbarButton active={commentEditor.isActive('heading', { level: 1 })} onClick={() => commentEditor.chain().focus().toggleHeading({ level: 1 }).run()} title="Titre 1">
                <Heading1 size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('heading', { level: 2 })} onClick={() => commentEditor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre 2">
                <Heading2 size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('heading', { level: 3 })} onClick={() => commentEditor.chain().focus().toggleHeading({ level: 3 }).run()} title="Titre 3">
                <Heading3 size={14} />
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={commentEditor.isActive('bold')} onClick={() => commentEditor.chain().focus().toggleBold().run()} title="Gras">
                <Bold size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('italic')} onClick={() => commentEditor.chain().focus().toggleItalic().run()} title="Italique">
                <Italic size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('underline')} onClick={() => commentEditor.chain().focus().toggleUnderline().run()} title="Souligné">
                <UnderlineIcon size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('strike')} onClick={() => commentEditor.chain().focus().toggleStrike().run()} title="Barré">
                <Strikethrough size={14} />
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'left' })} onClick={() => commentEditor.chain().focus().setTextAlign('left').run()} title="Aligner à gauche">
                <AlignLeft size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'center' })} onClick={() => commentEditor.chain().focus().setTextAlign('center').run()} title="Centrer">
                <AlignCenter size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'right' })} onClick={() => commentEditor.chain().focus().setTextAlign('right').run()} title="Aligner à droite">
                <AlignRight size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'justify' })} onClick={() => commentEditor.chain().focus().setTextAlign('justify').run()} title="Justifier">
                <AlignJustify size={14} />
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={commentEditor.isActive('bulletList')} onClick={() => commentEditor.chain().focus().toggleBulletList().run()} title="Liste à puces">
                <List size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('orderedList')} onClick={() => commentEditor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
                <ListOrdered size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('blockquote')} onClick={() => commentEditor.chain().focus().toggleBlockquote().run()} title="Citation">
                <Quote size={14} />
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={false} onClick={addImage} title="Insérer une image">
                <ImagePlus size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('link')} onClick={toggleLink} title={commentEditor.isActive('link') ? 'Retirer le lien' : 'Ajouter un lien'}>
                {commentEditor.isActive('link') ? <Unlink size={14} /> : <LinkIcon size={14} />}
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={false} onClick={() => commentEditor.chain().focus().clearNodes().unsetAllMarks().run()} title="Supprimer le formatage">
                <RemoveFormatting size={14} />
              </MiniToolbarButton>
            </div>
          )}
          <EditorContent
            editor={commentEditor}
            className="prose prose-sm max-w-none p-3 min-h-[80px] focus-within:ring-2 focus-within:ring-gold-400 rounded-b-lg"
          />
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAddComment}
            disabled={isCommentEmpty}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Commenter
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer le ticket ?"
        description="Cette action est irréversible. Le ticket et tous ses commentaires seront supprimés."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmDeleteCommentId !== null}
        title="Supprimer le commentaire ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (confirmDeleteCommentId) {
            await deleteComment(ticketId, confirmDeleteCommentId);
            setConfirmDeleteCommentId(null);
          }
        }}
        onCancel={() => setConfirmDeleteCommentId(null)}
      />
    </div>
  );
}

function MiniToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-7 h-7 rounded flex items-center justify-center text-xs font-medium transition-colors',
        active ? 'bg-bordeaux-100 text-bordeaux-600' : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
      )}
    >
      {children}
    </button>
  );
}
