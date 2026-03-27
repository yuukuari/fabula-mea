import { useRef, useCallback, memo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { SpellCheckExtension } from '@/lib/spellcheck-extension';
import { useBookStore } from '@/store/useBookStore';
import type { Scene } from '@/types';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Heading3, Quote, List, ListOrdered,
  ImagePlus, Link as LinkIcon, Unlink, Undo2, Redo2,
  RemoveFormatting,
} from 'lucide-react';

export function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

interface Props {
  scene: Scene;
  onFocus: (sceneId: string) => void;
}

// ── Toolbar button ───────────────────────────────────────────────
function TBtn({
  active, onClick, title, children, disabled,
}: {
  active?: boolean; onClick: () => void; title: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-bordeaux-100 text-bordeaux-600'
          : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-parchment-300 mx-0.5" />;
}

// ── Main component ───────────────────────────────────────────────
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
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-bordeaux-500 underline cursor-pointer',
          },
        },
      }),
      Placeholder.configure({ placeholder: 'Écrivez cette scène...' }),
      Typography.configure({
        // Guillemets français, tiret cadratin, points de suspension
        openDoubleQuote: '«\u00A0',
        closeDoubleQuote: '\u00A0»',
        openSingleQuote: '\u2018',
        closeSingleQuote: '\u2019',
        emDash: '—',
        ellipsis: '…',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'justify',
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4 mx-auto block',
        },
      }),
      SpellCheckExtension.configure({ language: 'fr', debounceMs: 800 }),
    ],
    content: scene.content ?? '',
    onUpdate: ({ editor: e }) => handleUpdate(e.getHTML()),
    onFocus: () => onFocus(scene.id),
    editorProps: {
      attributes: {
        class: 'outline-none font-serif text-ink-500 text-lg leading-relaxed min-h-[8rem] text-justify',
        spellcheck: 'false',
      },
    },
  });

  const addImage = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor.chain().focus().setImage({ src: reader.result }).run();
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  const toggleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL du lien :');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const s = 16; // icon size

  return (
    <div>
      {/* ── Toolbar fixe au-dessus de chaque scène ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 mb-3 bg-parchment-50 border border-parchment-200 rounded-lg sticky top-0 z-10">
        {/* Undo / Redo */}
        <TBtn onClick={() => editor.chain().focus().undo().run()} title="Annuler" disabled={!editor.can().undo()}>
          <Undo2 size={s} />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} title="Refaire" disabled={!editor.can().redo()}>
          <Redo2 size={s} />
        </TBtn>

        <Sep />

        {/* Headings */}
        <TBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Titre 1">
          <Heading1 size={s} />
        </TBtn>
        <TBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre 2">
          <Heading2 size={s} />
        </TBtn>
        <TBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Titre 3">
          <Heading3 size={s} />
        </TBtn>

        <Sep />

        {/* Text formatting */}
        <TBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras (Ctrl+B)">
          <Bold size={s} />
        </TBtn>
        <TBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique (Ctrl+I)">
          <Italic size={s} />
        </TBtn>
        <TBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné (Ctrl+U)">
          <UnderlineIcon size={s} />
        </TBtn>
        <TBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré">
          <Strikethrough size={s} />
        </TBtn>

        <Sep />

        {/* Alignment */}
        <TBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Aligner à gauche">
          <AlignLeft size={s} />
        </TBtn>
        <TBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrer">
          <AlignCenter size={s} />
        </TBtn>
        <TBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Aligner à droite">
          <AlignRight size={s} />
        </TBtn>
        <TBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justifier">
          <AlignJustify size={s} />
        </TBtn>

        <Sep />

        {/* Lists */}
        <TBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces">
          <List size={s} />
        </TBtn>
        <TBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
          <ListOrdered size={s} />
        </TBtn>
        <TBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citation">
          <Quote size={s} />
        </TBtn>
        <Sep />

        {/* Image & Link */}
        <TBtn onClick={addImage} title="Insérer une image">
          <ImagePlus size={s} />
        </TBtn>
        <TBtn active={editor.isActive('link')} onClick={toggleLink} title={editor.isActive('link') ? 'Retirer le lien' : 'Ajouter un lien'}>
          {editor.isActive('link') ? <Unlink size={s} /> : <LinkIcon size={s} />}
        </TBtn>

        <Sep />

        {/* Clear formatting */}
        <TBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Supprimer le formatage">
          <RemoveFormatting size={s} />
        </TBtn>
      </div>

      {/* ── Bubble menu (sélection) ── */}
      <BubbleMenu editor={editor} className="flex items-center gap-0.5 px-1.5 py-1 bg-white border border-parchment-300 rounded-lg shadow-lg z-20 relative">
        <TBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
          <Bold size={14} />
        </TBtn>
        <TBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
          <Italic size={14} />
        </TBtn>
        <TBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné">
          <UnderlineIcon size={14} />
        </TBtn>
        <TBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré">
          <Strikethrough size={14} />
        </TBtn>
        <Sep />
        <TBtn active={editor.isActive('link')} onClick={toggleLink} title="Lien">
          {editor.isActive('link') ? <Unlink size={14} /> : <LinkIcon size={14} />}
        </TBtn>
      </BubbleMenu>

      {/* ── Editor content ── */}
      <EditorContent editor={editor} />
    </div>
  );
});
