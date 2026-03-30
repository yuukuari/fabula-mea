import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Send, Trash2, X, Check, ChevronDown, Edit3, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewComment } from '@/types';

interface Props {
  comments: ReviewComment[];
  currentSceneId: string | null;
  activeCommentId: string | null;
  onHoverComment: (id: string | null) => void;
  onAddComment: (comment: {
    sceneId: string;
    content: string;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    parentId?: string;
  }) => void;
  onUpdateComment: (commentId: string, data: { content?: string; status?: ReviewComment['status'] }) => void;
  onDeleteComment: (commentId: string) => void;
  /** Current user label ("Jonathan", "Marie"...) */
  userLabel: string;
  /** Is the current user the author? */
  isAuthor: boolean;
  /** Pending selection from the content panel */
  pendingSelection: {
    sceneId: string;
    text: string;
    startOffset: number;
    endOffset: number;
  } | null;
  onClearPendingSelection: () => void;
  /** When true, disables all editing/commenting (completed session) */
  readOnly?: boolean;
}

export function ReviewCommentPanel({
  comments,
  currentSceneId,
  activeCommentId,
  onHoverComment,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  userLabel,
  isAuthor,
  pendingSelection,
  onClearPendingSelection,
  readOnly,
}: Props) {
  const [newContent, setNewContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter comments for current scene
  const sceneComments = useMemo(() => {
    if (!currentSceneId) return [];
    return comments
      .filter((c) => c.sceneId === currentSceneId && !c.parentId)
      .sort((a, b) => a.startOffset - b.startOffset);
  }, [comments, currentSceneId]);

  const getReplies = (parentId: string) =>
    comments
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Scroll to active comment
  useEffect(() => {
    if (activeCommentId && commentRefs.current[activeCommentId]) {
      commentRefs.current[activeCommentId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCommentId]);

  const handleSubmitNew = () => {
    if (!pendingSelection || !newContent.trim()) return;
    onAddComment({
      sceneId: pendingSelection.sceneId,
      content: newContent.trim(),
      selectedText: pendingSelection.text,
      startOffset: pendingSelection.startOffset,
      endOffset: pendingSelection.endOffset,
    });
    setNewContent('');
    onClearPendingSelection();
  };

  const handleSubmitReply = (parentId: string) => {
    if (!replyContent.trim() || !currentSceneId) return;
    const parent = comments.find((c) => c.id === parentId);
    if (!parent) return;
    onAddComment({
      sceneId: parent.sceneId,
      content: replyContent.trim(),
      selectedText: '',
      startOffset: parent.startOffset,
      endOffset: parent.endOffset,
      parentId,
    });
    setReplyContent('');
    setReplyingTo(null);
  };

  const handleEdit = (comment: ReviewComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editContent.trim()) return;
    onUpdateComment(commentId, { content: editContent.trim() });
    setEditingId(null);
    setEditContent('');
  };

  const draftCount = comments.filter((c) => c.status === 'draft' && !c.isAuthor).length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
      ' à ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-parchment-200 bg-parchment-50/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-ink-300" />
          <h3 className="font-medium text-sm text-ink-400">
            Commentaires
          </h3>
          {sceneComments.length > 0 && (
            <span className="text-xs text-ink-200">({sceneComments.length})</span>
          )}
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!currentSceneId ? (
          <p className="text-sm text-ink-200 text-center py-8">
            Sélectionnez une scène pour voir les commentaires.
          </p>
        ) : sceneComments.length === 0 && !pendingSelection ? (
          <p className="text-sm text-ink-200 text-center py-8">
            Aucun commentaire sur cette scène.
            {!readOnly && (
              <>
                <br />
                <span className="text-xs">Sélectionnez du texte pour ajouter un commentaire.</span>
              </>
            )}
          </p>
        ) : (
          sceneComments.map((comment) => {
            const replies = getReplies(comment.id);
            const isActive = activeCommentId === comment.id;

            return (
              <div
                key={comment.id}
                ref={(el) => { commentRefs.current[comment.id] = el; }}
                className={cn(
                  'rounded-lg border transition-all',
                  isActive
                    ? 'border-bordeaux-300 bg-bordeaux-50/50 shadow-sm'
                    : 'border-parchment-200 bg-white',
                  comment.status === 'closed' && 'opacity-60'
                )}
                onMouseEnter={() => onHoverComment(comment.id)}
                onMouseLeave={() => onHoverComment(null)}
              >
                {/* Main comment */}
                <div className="p-3">
                  {/* Selected text preview */}
                  {comment.selectedText && (
                    <div className="mb-2 px-2 py-1.5 bg-parchment-100 rounded text-xs text-ink-300 italic border-l-2 border-bordeaux-300 line-clamp-2">
                      « {comment.selectedText} »
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                      comment.isAuthor ? 'bg-bordeaux-100 text-bordeaux-600' : 'bg-blue-100 text-blue-600'
                    )}>
                      {comment.authorLabel.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-ink-400">{comment.authorLabel}</span>
                        <span className="text-[10px] text-ink-200">{formatDate(comment.createdAt)}</span>
                        {comment.status === 'draft' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full">Brouillon</span>
                        )}
                        {comment.status === 'closed' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full">Résolu</span>
                        )}
                      </div>

                      {editingId === comment.id ? (
                        <div className="mt-1">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-parchment-300 rounded resize-none
                                     focus:border-bordeaux-300 focus:ring-1 focus:ring-bordeaux-200 outline-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => handleSaveEdit(comment.id)} className="text-xs text-bordeaux-500 hover:underline">
                              Enregistrer
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-ink-200 hover:underline">
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-ink-400 whitespace-pre-wrap">{comment.content}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {comment.status !== 'closed' && !readOnly && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Author can close */}
                        {isAuthor && comment.status === 'sent' && (
                          <button
                            onClick={() => onUpdateComment(comment.id, { status: 'closed' })}
                            className="p-1 rounded text-green-400 hover:text-green-500 hover:bg-green-50"
                            title="Résoudre"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Own comments can be edited/deleted */}
                        {((isAuthor && comment.isAuthor) || (!isAuthor && !comment.isAuthor)) && editingId !== comment.id && (
                          <>
                            <button
                              onClick={() => handleEdit(comment)}
                              className="p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-100"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteComment(comment.id)}
                              className="p-1 rounded text-red-300 hover:text-red-500 hover:bg-red-50"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {replies.length > 0 && (
                  <div className="border-t border-parchment-100 px-3 py-2 space-y-2 bg-parchment-50/30">
                    {replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2 pl-2">
                        <CornerDownRight className="w-3 h-3 text-ink-200 mt-1 flex-shrink-0" />
                        <div className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
                          reply.isAuthor ? 'bg-bordeaux-100 text-bordeaux-600' : 'bg-blue-100 text-blue-600'
                        )}>
                          {reply.authorLabel.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-ink-400">{reply.authorLabel}</span>
                            <span className="text-[10px] text-ink-200">{formatDate(reply.createdAt)}</span>
                          </div>
                          {editingId === reply.id ? (
                            <div>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-parchment-300 rounded resize-none
                                         focus:border-bordeaux-300 outline-none"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex gap-1 mt-1">
                                <button onClick={() => handleSaveEdit(reply.id)} className="text-xs text-bordeaux-500 hover:underline">Enregistrer</button>
                                <button onClick={() => setEditingId(null)} className="text-xs text-ink-200 hover:underline">Annuler</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-ink-400 whitespace-pre-wrap">{reply.content}</p>
                          )}
                        </div>
                        {!readOnly && ((isAuthor && reply.isAuthor) || (!isAuthor && !reply.isAuthor)) && editingId !== reply.id && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => handleEdit(reply)} className="p-0.5 rounded text-ink-200 hover:text-ink-400">
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={() => onDeleteComment(reply.id)} className="p-0.5 rounded text-red-300 hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {comment.status !== 'closed' && !readOnly && (
                  <div className="border-t border-parchment-100 px-3 py-2">
                    {replyingTo === comment.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmitReply(comment.id)}
                          placeholder="Répondre..."
                          className="flex-1 px-2 py-1 text-xs border border-parchment-300 rounded
                                   focus:border-bordeaux-300 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={!replyContent.trim()}
                          className="p-1 rounded text-bordeaux-500 hover:bg-bordeaux-50 disabled:opacity-30"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setReplyingTo(null); setReplyContent(''); }} className="p-1 rounded text-ink-200 hover:bg-parchment-100">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(comment.id)}
                        className="text-xs text-bordeaux-500 hover:underline"
                      >
                        Répondre
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* New comment form from text selection */}
        {pendingSelection && !readOnly && (
          <div className="rounded-lg border border-bordeaux-300 bg-bordeaux-50/30 p-3">
            <div className="mb-2 px-2 py-1.5 bg-parchment-100 rounded text-xs text-ink-300 italic border-l-2 border-bordeaux-300 line-clamp-2">
              « {pendingSelection.text} »
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Ajouter un commentaire..."
              className="w-full px-3 py-2 text-sm border border-parchment-300 rounded-lg resize-none
                       focus:border-bordeaux-300 focus:ring-1 focus:ring-bordeaux-200 outline-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-between items-center mt-2">
              <button
                onClick={() => { onClearPendingSelection(); setNewContent(''); }}
                className="text-xs text-ink-200 hover:text-ink-400"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitNew}
                disabled={!newContent.trim()}
                className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-30"
              >
                <Send className="w-3 h-3" />
                Commenter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
