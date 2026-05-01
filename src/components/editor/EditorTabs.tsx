import { useEffect } from 'react';
import { PenLine, BookOpen } from 'lucide-react';
import { useEditorStore } from '@/store/useEditorStore';
import { useBookStore } from '@/store/useBookStore';
import { useReaderStore } from '@/store/useReaderStore';
import { cn } from '@/lib/utils';

export function EditorTabs() {
  const { entrySceneId, isOpen, open, minimize, setEntryScene } = useEditorStore();
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const writingMode = useBookStore((s) => s.writingMode);
  const readerOpen = useReaderStore((s) => s.open);
  const openReader = useReaderStore((s) => s.openReader);
  const closeReader = useReaderStore((s) => s.closeReader);

  // Show the writing tab (without opening the editor) when in write mode and there are scenes
  useEffect(() => {
    if (writingMode === 'write' && scenes.length > 0 && !entrySceneId) {
      const firstScene = scenes[0];
      if (firstScene) setEntryScene(firstScene.id);
    }
  }, [writingMode, scenes, entrySceneId, setEntryScene]);

  const showWriting = writingMode === 'write' && scenes.length > 0 && !!entrySceneId;
  // Reader makes sense only when there is actual content to read — i.e. at
  // least one scene with non-empty content (count mode users can still have
  // text in their scenes, hence we don't gate this on writingMode).
  const showReader = chapters.length > 0 && scenes.some((s) => (s.content?.replace(/<[^>]*>/g, '').trim() ?? '').length > 0);

  if (!showWriting && !showReader) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-1.5
                    bg-ink-500/90 backdrop-blur-sm rounded-full px-2 py-1.5 shadow-2xl
                    border border-ink-400/30">
      {showWriting && (
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 h-7 rounded-full cursor-pointer text-xs font-medium',
            'transition-all shrink-0 max-w-[240px]',
            isOpen
              ? 'bg-bordeaux-500 text-white'
              : 'text-parchment-200 hover:bg-white/10 hover:text-white'
          )}
          onClick={() => {
            if (isOpen) {
              minimize();
            } else if (entrySceneId) {
              if (readerOpen) closeReader();
              open(entrySceneId);
            }
          }}
          title={isOpen ? "Réduire l'éditeur" : "Rouvrir l'éditeur"}
        >
          <PenLine className="w-3 h-3 shrink-0" />
          <span className="truncate">Mode écriture</span>
        </div>
      )}

      {showReader && (
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 h-7 rounded-full cursor-pointer text-xs font-medium',
            'transition-all shrink-0',
            readerOpen
              ? 'bg-bordeaux-500 text-white'
              : 'text-parchment-200 hover:bg-white/10 hover:text-white'
          )}
          onClick={() => {
            if (readerOpen) {
              closeReader();
            } else {
              if (isOpen) minimize();
              openReader();
            }
          }}
          title={readerOpen ? 'Fermer le mode lecture' : 'Ouvrir le mode lecture'}
        >
          <BookOpen className="w-3 h-3 shrink-0" />
          <span>Mode lecture</span>
        </div>
      )}
    </div>
  );
}
