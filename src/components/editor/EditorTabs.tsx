import { X, PenLine, ChevronUp } from 'lucide-react';
import { useEditorStore } from '@/store/useEditorStore';
import { useBookStore } from '@/store/useBookStore';
import { cn } from '@/lib/utils';

export function EditorTabs() {
  const { entrySceneId, isOpen, open, close, minimize } = useEditorStore();
  const scenes = useBookStore((s) => s.scenes);

  if (!entrySceneId) return null;

  const scene = scenes.find((s) => s.id === entrySceneId);
  if (!scene) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5
                    bg-ink-500/90 backdrop-blur-sm rounded-full px-2 py-1.5 shadow-2xl
                    border border-ink-400/30">
      {/* Unique onglet */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-3 h-7 rounded-full cursor-pointer text-xs font-medium',
          'transition-all group shrink-0 max-w-[240px]',
          isOpen
            ? 'bg-bordeaux-500 text-white'
            : 'text-parchment-200 hover:bg-white/10 hover:text-white'
        )}
        onClick={() => {
          if (isOpen) minimize();
          else open(entrySceneId);
        }}
        title={isOpen ? 'Réduire l\'éditeur' : 'Rouvrir l\'éditeur'}
      >
        <PenLine className="w-3 h-3 shrink-0" />
        <span className="truncate">Mode écriture</span>
        {isOpen && <ChevronUp className="w-3 h-3 shrink-0 opacity-70" />}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); close(); }}
          className="ml-0.5 p-0.5 rounded-full shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
          title="Fermer le mode écriture"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
