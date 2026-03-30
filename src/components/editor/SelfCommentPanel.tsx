import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Trash2, Edit3, Check, X, MessageCircle } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { cn } from '@/lib/utils';
import type { SelfComment } from '@/types';

interface PendingSelection {
  selectedText: string;
  startOffset: number;
  endOffset: number;
}

interface Props {
  sceneId: string;
  pendingSelection: PendingSelection | null;
  onClearSelection: () => void;
  onHighlightComment: (commentId: string | null) => void;
  activeCommentId: string | null;
}

export function SelfCommentPanel({ sceneId, pendingSelection, onClearSelection, onHighlightComment, activeCommentId }: Props) {
  const selfComments = useBookStore((s) => s.selfComments ?? []);
  const addSelfComment = useBookStore((s) => s.addSelfComment);
  const updateSelfComment = useBookStore((s) => s.updateSelfComment);
  const deleteSelfComment = useBookStore((s) => s.deleteSelfComment);

  const sceneComments = selfComments
    .filter((c) => c.sceneId === sceneId)
    .sort((a, b) => a.startOffset - b.startOffset);

  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const newInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when selection arrives
  useEffect(() => {
    if (pendingSelection && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [pendingSelection]);

  const handleAdd = () => {
    if (!pendingSelection || !newContent.trim()) return;
    addSelfComment({
      sceneId,
      selectedText: pendingSelection.selectedText,
      startOffset: pendingSelection.startOffset,
      endOffset: pendingSelection.endOffset,
      content: newContent.trim(),
    });
    setNewContent('');
    onClearSelection();
  };

  const handleUpdate = (id: string) => {
    if (!editContent.trim()) return;
    updateSelfComment(id, { content: editContent.trim() });
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = (id: string) => {
    deleteSelfComment(id);
    if (activeCommentId === id) onHighlightComment(null);
  };

  const startEdit = (comment: SelfComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-parchment-200 flex items-center gap-2 shrink-0">
        <MessageCircle className="w-3.5 h-3.5 text-bordeaux-400" />
        <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
          Notes ({sceneComments.length})
        </span>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {sceneComments.length === 0 && !pendingSelection && (
          <div className="px-3 py-6 text-center">
            <MessageSquarePlus className="w-6 h-6 mx-auto mb-2 text-ink-200 opacity-40" />
            <p className="text-xs text-ink-200 italic">
              Sélectionnez du texte dans l'éditeur pour ajouter une note
            </p>
          </div>
        )}

        {sceneComments.map((comment) => {
          const isActive = activeCommentId === comment.id;
          const isEditing = editingId === comment.id;

          return (
            <div
              key={comment.id}
              className={cn(
                'px-3 py-2.5 border-b border-parchment-100 cursor-pointer transition-colors',
                isActive ? 'bg-bordeaux-50' : 'hover:bg-parchment-100'
              )}
              onClick={() => onHighlightComment(isActive ? null : comment.id)}
            >
              {/* Selected text excerpt */}
              <div className="flex items-start gap-1.5 mb-1.5">
                <div
                  className="flex-1 text-[11px] text-ink-300 italic truncate border-l-2 border-bordeaux-200 pl-1.5"
                  title={comment.selectedText}
                >
                  « {comment.selectedText.length > 50 ? comment.selectedText.slice(0, 50) + '…' : comment.selectedText} »
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-xs p-1.5 border border-parchment-300 rounded bg-white resize-none focus:outline-none focus:ring-1 focus:ring-bordeaux-300"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 text-ink-200 hover:text-ink-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleUpdate(comment.id)}
                      className="p-1 text-bordeaux-500 hover:text-bordeaux-700"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-ink-500 whitespace-pre-wrap">{comment.content}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-ink-200">
                      {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startEdit(comment)}
                        className="p-1 text-ink-200 hover:text-bordeaux-500 transition-colors"
                        title="Modifier"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 text-ink-200 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* New comment form (when text is selected) */}
      {pendingSelection && (
        <div className="border-t border-parchment-200 p-3 bg-parchment-50 shrink-0">
          <div className="text-[11px] text-ink-300 italic mb-1.5 truncate border-l-2 border-gold-300 pl-1.5">
            « {pendingSelection.selectedText.length > 60
              ? pendingSelection.selectedText.slice(0, 60) + '…'
              : pendingSelection.selectedText} »
          </div>
          <textarea
            ref={newInputRef}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Votre note..."
            className="w-full text-xs p-2 border border-parchment-300 rounded bg-white resize-none focus:outline-none focus:ring-1 focus:ring-bordeaux-300"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleAdd();
              }
            }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <button
              onClick={onClearSelection}
              className="text-[10px] text-ink-200 hover:text-ink-400"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!newContent.trim()}
              className="text-xs px-2.5 py-1 bg-bordeaux-500 text-white rounded hover:bg-bordeaux-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
