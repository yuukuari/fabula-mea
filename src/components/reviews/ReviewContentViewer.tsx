import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { injectHighlights, getSelectionOffsets } from '@/lib/review-highlights';
import type { ReviewComment, ReviewSnapshotScene } from '@/types';

interface Props {
  scene: ReviewSnapshotScene;
  comments: ReviewComment[];
  activeCommentId: string | null;
  onHoverComment: (id: string | null) => void;
  /** If undefined, text selection for commenting is disabled (readOnly mode) */
  onSelectText?: (data: { sceneId: string; text: string; startOffset: number; endOffset: number }) => void;
}

export function ReviewContentViewer({ scene, comments, activeCommentId, onHoverComment, onSelectText }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const selectionDataRef = useRef<{ text: string; startOffset: number; endOffset: number } | null>(null);

  // Build highlights from comments
  const sceneComments = useMemo(
    () => comments.filter((c) => c.sceneId === scene.id && !c.parentId && c.selectedText),
    [comments, scene.id]
  );

  const highlightedHtml = useMemo(() => {
    if (!scene.content) return '';
    const ranges = sceneComments.map((c) => ({
      id: c.id,
      startOffset: c.startOffset,
      endOffset: c.endOffset,
      isActive: activeCommentId === c.id,
    }));
    return injectHighlights(scene.content, ranges);
  }, [scene.content, sceneComments, activeCommentId]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    if (!contentRef.current || !onSelectText) return;

    const data = getSelectionOffsets(contentRef.current);
    if (!data) {
      setShowTooltip(false);
      return;
    }

    // Position tooltip near the selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = contentRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 8,
      });
    }

    selectionDataRef.current = data;
    setShowTooltip(true);
  }, []);

  const handleAddComment = useCallback(() => {
    if (!selectionDataRef.current || !onSelectText) return;
    onSelectText({
      sceneId: scene.id,
      ...selectionDataRef.current,
    });
    setShowTooltip(false);
    window.getSelection()?.removeAllRanges();
  }, [onSelectText, scene.id]);

  // Handle clicking on highlighted text to focus comment
  const handleClick = useCallback((e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('mark[data-comment-id]');
    if (mark) {
      const commentId = mark.getAttribute('data-comment-id');
      if (commentId) onHoverComment(commentId);
    }
  }, [onHoverComment]);

  // Handle hover on highlights
  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('mark[data-comment-id]');
    if (mark) {
      const commentId = mark.getAttribute('data-comment-id');
      if (commentId) onHoverComment(commentId);
    }
  }, [onHoverComment]);

  const handleMouseOut = useCallback((e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('mark[data-comment-id]');
    if (mark) {
      onHoverComment(null);
    }
  }, [onHoverComment]);

  // Dismiss tooltip on scroll or outside click
  useEffect(() => {
    const dismiss = () => setShowTooltip(false);
    document.addEventListener('scroll', dismiss, true);
    return () => document.removeEventListener('scroll', dismiss, true);
  }, []);

  return (
    <div className="relative">
      {/* Scene title */}
      {scene.title && (
        <h3 className="font-display text-lg font-bold text-ink-500 mb-3">{scene.title}</h3>
      )}
      {scene.description && (
        <p className="text-sm text-ink-300 italic mb-4">{scene.description}</p>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className="prose prose-sm max-w-none text-ink-400 review-content"
        dangerouslySetInnerHTML={{ __html: highlightedHtml || '<p class="text-ink-200 italic">Pas de contenu</p>' }}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      />

      {/* Selection tooltip */}
      {showTooltip && (
        <div
          className="absolute z-20 transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <button
            onClick={handleAddComment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bordeaux-500 text-white text-xs rounded-lg shadow-lg
                     hover:bg-bordeaux-600 transition-colors whitespace-nowrap"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Commenter
          </button>
          <div className="w-2 h-2 bg-bordeaux-500 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}
