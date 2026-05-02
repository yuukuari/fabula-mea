import { useRef, useCallback, memo, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { SpellCheckExtension } from '@/lib/spellcheck-extension';
import { FontSize } from '@/lib/font-size-extension';
import { WritingAidHighlightExtension } from '@/lib/writing-aid/highlight-extension';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { FONT_STACKS, AVAILABLE_FONTS, AVAILABLE_FONT_SIZES, DEFAULT_LAYOUT } from '@/lib/fonts';
import { countFromHtml, countWordsFromHtml } from '@/lib/utils';
import type { Scene, BookFont, BookFontSize } from '@/types';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Quote, List, ListOrdered,
  ImagePlus, Link as LinkIcon, Unlink, Undo2, Redo2,
  RemoveFormatting,
} from 'lucide-react';

/** @deprecated Use countFromHtml from utils instead. Kept for external imports. */
export function countWords(html: string): number {
  return countWordsFromHtml(html);
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

/** Strip all inline styles from pasted HTML, keep semantic elements */
function cleanPastedHtml(html: string): string {
  return html
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\s+class="[^"]*"/g, '')
    .replace(/\s+id="[^"]*"/g, '')
    .replace(/\s+data-[a-z-]+="[^"]*"/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ');
}

// ── Main component ───────────────────────────────────────────────
export const SceneInlineEditor = memo(function SceneInlineEditor({ scene, onFocus }: Props) {
  const updateSceneContent = useBookStore((s) => s.updateSceneContent);
  const layout = useBookStore((s) => s.layout);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const customDictionary = useBookStore((s) => s.customDictionary ?? []);
  const addToCustomDictionary = useBookStore((s) => s.addToCustomDictionary);
  const { characters, places, worldNotes } = useEncyclopediaStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Force re-render on selection change so font/size selectors reflect the selection
  const [, forceUpdate] = useState(0);

  // Build a stable ref for custom words (custom dictionary + encyclopedia names)
  const customWordsRef = useRef<string[]>([]);
  const encyclopediaNames = useMemo(() => {
    const names: string[] = [];
    for (const c of characters) {
      if (c.name) names.push(c.name);
      if (c.surname) names.push(c.surname);
      if (c.nickname) names.push(c.nickname);
    }
    for (const p of places) {
      if (p.name) names.push(p.name);
    }
    for (const w of worldNotes) {
      if (w.title) names.push(w.title);
    }
    return names;
  }, [characters, places, worldNotes]);

  // Keep ref up to date (avoids recreating the editor on every change)
  customWordsRef.current = [...customDictionary, ...encyclopediaNames];

  const fontFamily = layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontStack = FONT_STACKS[fontFamily];

  const editorStyle = useMemo(() => ({
    fontFamily: fontStack,
    fontSize: `${fontSize}pt`,
    lineHeight: `${lineHeight}`,
  }), [fontStack, fontSize, lineHeight]);

  const handleUpdate = useCallback(
    (html: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateSceneContent(scene.id, html, countFromHtml(html, countUnit));
      }, 800);
    },
    [scene.id, updateSceneContent, countUnit]
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
      TextStyle,
      FontFamily,
      FontSize,
      SpellCheckExtension.configure({
        language: 'fr',
        spellingDebounceMs: 300,
        grammarDebounceMs: 1500,
        getCustomWords: () => customWordsRef.current,
        onAddToDictionary: addToCustomDictionary,
      }),
      WritingAidHighlightExtension.configure({ sceneId: scene.id }),
    ],
    content: scene.content ?? '',
    onUpdate: ({ editor: e }) => handleUpdate(e.getHTML()),
    onFocus: () => onFocus(scene.id),
    onSelectionUpdate: () => forceUpdate((n) => n + 1),
    editorProps: {
      attributes: {
        class: 'outline-none text-ink-500 min-h-[8rem] text-justify',
        spellcheck: 'false',
      },
      transformPastedHTML: (html) => cleanPastedHtml(html),
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

  // Current font: read from textStyle attributes (updates on selection via forceUpdate)
  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || '';
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '';

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

        {/* Font family selector */}
        <select
          value={currentFontFamily}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              editor.chain().focus().setFontFamily(val).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
          className="h-7 text-xs bg-white border border-parchment-200 rounded px-1 text-ink-400 cursor-pointer hover:border-parchment-400"
          title="Police du texte sélectionné"
        >
          <option value="">Par défaut</option>
          {AVAILABLE_FONTS.map((f) => (
            <option key={f} value={FONT_STACKS[f]} style={{ fontFamily: FONT_STACKS[f] }}>{f}</option>
          ))}
        </select>

        {/* Font size selector */}
        <select
          value={currentFontSize}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              editor.chain().focus().setFontSize(val).run();
            } else {
              editor.chain().focus().unsetFontSize().run();
            }
          }}
          className="h-7 text-xs bg-white border border-parchment-200 rounded px-1 text-ink-400 cursor-pointer hover:border-parchment-400"
          title="Taille du texte sélectionné"
        >
          <option value="">Défaut</option>
          {AVAILABLE_FONT_SIZES.map((sz) => (
            <option key={sz} value={`${sz}pt`}>{sz} pt</option>
          ))}
        </select>

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
      <div style={editorStyle}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
