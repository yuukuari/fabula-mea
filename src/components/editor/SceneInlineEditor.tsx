import { useRef, useCallback, memo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useBookStore } from '@/store/useBookStore';
import type { Scene } from '@/types';

export function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

interface Props {
  scene: Scene;
  onFocus: (sceneId: string) => void;
}

export const SceneInlineEditor = memo(function SceneInlineEditor({ scene, onFocus }: Props) {
  const updateSceneContent = useBookStore((s) => s.updateSceneContent);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdate = useCallback(
    (html: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateSceneContent(scene.id, html, countWords(html));
      }, 800);
    },
    [scene.id, updateSceneContent]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Écrivez cette scène...' }),
    ],
    content: scene.content ?? '',
    onUpdate: ({ editor }) => handleUpdate(editor.getHTML()),
    onFocus: () => onFocus(scene.id),
    editorProps: {
      attributes: {
        class: 'outline-none font-serif text-ink-500 text-lg leading-relaxed min-h-[8rem]',
      },
    },
  });

  return <EditorContent editor={editor} />;
});
