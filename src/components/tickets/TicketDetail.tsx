import { useEffect, useState, useRef, useCallback } from 'react';
import {
  EyeOff, Clock, CheckCircle, Copy,
  Trash2, ChevronLeft, Send, MessageSquare, Tag, SmilePlus, ExternalLink, ArrowRightLeft, Layers,
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
import { TYPE_CONFIG, STATUS_CONFIG, MODULE_LABELS, QUICK_REACTIONS } from './ticket-constants';
import type { TicketType, TicketStatus, TicketModule, TicketComment, TicketStatusChange } from '@/types';

interface Props {
  ticketId: string;
  onBack: () => void;
}

export function TicketDetail({ ticketId, onBack }: Props) {
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
              {isAdmin ? (
                <select
                  value={ticket.type}
                  onChange={(e) => updateTicket(ticketId, { type: e.target.value as TicketType })}
                  className={cn('badge cursor-pointer border-0', typeConf.color)}
                >
                  {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
                    <option key={key} value={key}>{conf.label}</option>
                  ))}
                </select>
              ) : (
                <span className={cn('badge', typeConf.color)}>
                  <TypeIcon className="w-3.5 h-3.5 mr-1" />
                  {typeConf.label}
                </span>
              )}
              <span className={cn('badge', statusConf.color)}>
                {statusConf.label}
              </span>
              {ticket.visibility === 'private' && (
                <span className="badge bg-gray-100 text-gray-500">
                  <EyeOff className="w-3 h-3 mr-1" /> Priv\u00e9
                </span>
              )}
              {isAdmin ? (
                <select
                  value={ticket.module ?? ''}
                  onChange={(e) => updateTicket(ticketId, { module: (e.target.value || undefined) as TicketModule | undefined })}
                  className="badge bg-purple-50 text-purple-600 cursor-pointer border-0"
                >
                  <option value="">Aucune section</option>
                  {Object.entries(MODULE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              ) : ticket.module && MODULE_LABELS[ticket.module] ? (
                <span className="badge bg-purple-50 text-purple-600">
                  {MODULE_LABELS[ticket.module]}
                </span>
              ) : null}
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
                    <CheckCircle className="w-3.5 h-3.5" /> Termin\u00e9
                  </button>
                  <button
                    onClick={() => handleStatusChange('closed_duplicate')}
                    className="btn-ghost text-xs flex items-center gap-1 text-gray-500 hover:bg-gray-100"
                  >
                    <Copy className="w-3.5 h-3.5" /> Dupliqu\u00e9
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
            <span className="text-sm text-ink-300">Version :</span>
            <select
              value={ticket.releaseId ?? ''}
              onChange={(e) => handleReleaseAssign(e.target.value)}
              className="text-sm border border-parchment-300 rounded px-2 py-1 bg-white"
            >
              <option value="">Aucune</option>
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.version}{r.title ? ` \u2014 ${r.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : ticket.releaseId ? (
          <div className="flex items-center gap-2 pt-3 border-t border-parchment-200">
            <Tag className="w-4 h-4 text-ink-200" />
            <span className="text-sm text-ink-300">Version :</span>
            {(() => {
              const rel = releases.find((r) => r.id === ticket.releaseId);
              return rel ? (
                <button
                  onClick={() => navigate('/releases')}
                  className="text-sm text-bordeaux-500 hover:underline flex items-center gap-1"
                >
                  {rel.version}{rel.title ? ` \u2014 ${rel.title}` : ''}
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
          className="tiptap max-w-none mt-4 pt-4 border-t border-parchment-200 text-sm"
          dangerouslySetInnerHTML={{ __html: ticket.description }}
        />

        {/* Reactions on description */}
        <div className="flex items-center gap-2 mt-3">
          <div className="relative" ref={showReactions === '__desc__' ? reactionsRef : undefined}>
            <button
              onClick={() => setShowReactions(showReactions === '__desc__' ? null : '__desc__')}
              className="p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-100"
              title="Ajouter une r\u00e9action"
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
          Activit\u00e9 ({timeline.length})
        </h2>

        {timeline.length === 0 && (
          <p className="text-sm text-ink-200 py-4 text-center">Aucune activit\u00e9 pour le moment</p>
        )}

        {timeline.map((entry) => {
          if (entry.kind === 'status') {
            const sc = entry.data;

            // Type change activity
            if (sc.type === 'type_change') {
              const fromConf = sc.fromType ? TYPE_CONFIG[sc.fromType] : null;
              const toConf = sc.toType ? TYPE_CONFIG[sc.toType] : null;
              return (
                <div
                  key={sc.id}
                  className="flex items-center gap-2 px-4 py-2 bg-parchment-50 rounded-lg text-xs text-ink-300 border border-parchment-200"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span className="font-medium">{sc.userName}</span>
                  a chang\u00e9 le type de
                  {fromConf && <span className={cn('badge text-[10px]', fromConf.color)}>{fromConf.label}</span>}
                  vers
                  {toConf && <span className={cn('badge text-[10px]', toConf.color)}>{toConf.label}</span>}
                  <span className="ml-auto text-ink-200">
                    {new Date(sc.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              );
            }

            // Module change activity
            if (sc.type === 'module_change') {
              const fromLabel = sc.fromModule ? MODULE_LABELS[sc.fromModule] : null;
              const toLabel = sc.toModule ? MODULE_LABELS[sc.toModule] : null;
              return (
                <div
                  key={sc.id}
                  className="flex items-center gap-2 px-4 py-2 bg-parchment-50 rounded-lg text-xs text-ink-300 border border-parchment-200"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="font-medium">{sc.userName}</span>
                  {toLabel
                    ? <>
                        a chang\u00e9 la section vers
                        <span className="badge bg-purple-50 text-purple-600 text-[10px]">{toLabel}</span>
                      </>
                    : <>a retir\u00e9 la section <span className="badge bg-purple-50 text-purple-600 text-[10px]">{fromLabel}</span></>}
                  <span className="ml-auto text-ink-200">
                    {new Date(sc.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              );
            }

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
                        a planifi\u00e9 ce ticket dans la version
                        <span className="badge bg-blue-100 text-blue-700 text-[10px]">{sc.releaseName || sc.releaseId}</span>
                      </>
                    : <>a retir\u00e9 ce ticket de sa version</>}
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
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="font-medium">{sc.userName}</span>
                a chang\u00e9 le statut de
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
                      title="Ajouter une r\u00e9action"
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
              <div className="tiptap max-w-none text-sm text-ink-400" dangerouslySetInnerHTML={{ __html: comment.content }} />
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
              <MiniToolbarButton active={commentEditor.isActive('underline')} onClick={() => commentEditor.chain().focus().toggleUnderline().run()} title="Soulign\u00e9">
                <UnderlineIcon size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('strike')} onClick={() => commentEditor.chain().focus().toggleStrike().run()} title="Barr\u00e9">
                <Strikethrough size={14} />
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'left' })} onClick={() => commentEditor.chain().focus().setTextAlign('left').run()} title="Aligner \u00e0 gauche">
                <AlignLeft size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'center' })} onClick={() => commentEditor.chain().focus().setTextAlign('center').run()} title="Centrer">
                <AlignCenter size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'right' })} onClick={() => commentEditor.chain().focus().setTextAlign('right').run()} title="Aligner \u00e0 droite">
                <AlignRight size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive({ textAlign: 'justify' })} onClick={() => commentEditor.chain().focus().setTextAlign('justify').run()} title="Justifier">
                <AlignJustify size={14} />
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={commentEditor.isActive('bulletList')} onClick={() => commentEditor.chain().focus().toggleBulletList().run()} title="Liste \u00e0 puces">
                <List size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('orderedList')} onClick={() => commentEditor.chain().focus().toggleOrderedList().run()} title="Liste num\u00e9rot\u00e9e">
                <ListOrdered size={14} />
              </MiniToolbarButton>
              <MiniToolbarButton active={commentEditor.isActive('blockquote')} onClick={() => commentEditor.chain().focus().toggleBlockquote().run()} title="Citation">
                <Quote size={14} />
              </MiniToolbarButton>
              <div className="w-px bg-parchment-300 mx-1 h-5" />
              <MiniToolbarButton active={false} onClick={addImage} title="Ins\u00e9rer une image">
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
        description="Cette action est irr\u00e9versible. Le ticket et tous ses commentaires seront supprim\u00e9s."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmDeleteCommentId !== null}
        title="Supprimer le commentaire ?"
        description="Cette action est irr\u00e9versible."
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
