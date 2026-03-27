import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { X, Minus, Bold, Italic, List, ListOrdered, Heading2, Undo, Redo } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEditorStore } from '@/store/useEditorStore';
import { cn } from '@/lib/utils';

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

export function SceneEditor() {
  const { activeSceneId, isOpen, minimize, closeScene } = useEditorStore();
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const updateSceneContent = useBookStore((s) => s.updateSceneContent);

  const scene = scenes.find((s) => s.id === activeSceneId);
  const chapter = scene ? chapters.find((c) => c.id === scene.chapterId) : null;

  // Auto-save debounce
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdate = useCallback(
    (html: string) => {
      if (!activeSceneId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const wc = countWords(html);
        updateSceneContent(activeSceneId, html, wc);
      }, 800);
    },
    [activeSceneId, updateSceneContent]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Commencez à écrire votre scène...',
      }),
      CharacterCount,
    ],
    content: scene?.content ?? '',
    onUpdate: ({ editor }) => handleUpdate(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[calc(100vh-12rem)] font-serif text-ink-500 text-lg leading-relaxed px-2',
      },
    },
  });

  // When the active scene changes, load its content into the editor
  useEffect(() => {
    if (!editor || !scene) return;
    const current = editor.getHTML();
    const target = scene.content ?? '';
    if (current !== target) {
      editor.commands.setContent(target, { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  // Escape → minimize
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') minimize();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, minimize]);

  if (!isOpen || !scene) return null;

  const wordCount = editor ? countWords(editor.getHTML()) : scene.currentWordCount;
  const progress = scene.targetWordCount > 0
    ? Math.min(100, Math.round((wordCount / scene.targetWordCount) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-parchment-50">
      {/* Top bar */}
      <div className="h-14 border-b border-parchment-200 bg-parchment-100/80 backdrop-blur-sm
                      flex items-center px-4 gap-3 shrink-0">
        {/* Chapter / Scene breadcrumb */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {chapter && (
            <>
              <span className="text-xs text-ink-200 truncate hidden sm:inline">{chapter.title}</span>
              <span className="text-xs text-ink-200 hidden sm:inline">›</span>
            </>
          )}
          <span className="text-sm font-display font-semibold text-ink-400 truncate">{scene.title}</span>
        </div>

        {/* Word count & progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-ink-300">{wordCount} / {scene.targetWordCount} mots</p>
            <div className="h-1 w-24 bg-parchment-200 rounded-full overflow-hidden mt-0.5">
              <div
                className={cn('h-full rounded-full transition-all', progress >= 100 ? 'bg-green-500' : 'bg-bordeaux-400')}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Minimize */}
          <button
            onClick={minimize}
            className="btn-ghost p-2"
            title="Réduire"
          >
            <Minus className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={() => closeScene(scene.id)}
            className="btn-ghost p-2 hover:text-red-500"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-10 border-b border-parchment-200 bg-white/50 flex items-center px-4 gap-1 shrink-0">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive('bold')}
          title="Gras"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive('italic')}
          title="Italique"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-parchment-200 mx-1" />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor?.isActive('heading', { level: 2 })}
          title="Titre"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive('bulletList')}
          title="Liste"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive('orderedList')}
          title="Liste numérotée"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-parchment-200 mx-1" />
        <ToolbarButton
          onClick={() => editor?.chain().focus().undo().run()}
          title="Annuler"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().redo().run()}
          title="Rétablir"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />
        <span className="text-xs text-ink-200 pr-1">Sauvegarde auto</span>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
          {scene.description && (
            <p className="text-sm text-ink-200 italic mb-8 font-serif border-l-2 border-parchment-300 pl-3">
              {scene.description}
            </p>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-bordeaux-100 text-bordeaux-600'
          : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
      )}
    >
      {children}
    </button>
  );
}
