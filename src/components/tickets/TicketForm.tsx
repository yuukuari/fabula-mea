import { useState, useCallback } from 'react';
import {
  X, Send, CheckCircle,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Heading3, Quote, List, ListOrdered,
  ImagePlus, Link as LinkIcon, Unlink, RemoveFormatting,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { cn } from '@/lib/utils';
import { useTicketStore } from '@/store/useTicketStore';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { TicketType, TicketVisibility } from '@/types';
import { useNavigate } from 'react-router-dom';

const TICKET_TYPES: { value: TicketType; label: string; color: string; emoji: string }[] = [
  { value: 'bug', label: 'Bug', color: 'bg-red-100 text-red-700 border-red-200', emoji: '🐛' },
  { value: 'question', label: 'Question', color: 'bg-blue-100 text-blue-700 border-blue-200', emoji: '❓' },
  { value: 'improvement', label: 'Amélioration', color: 'bg-green-100 text-green-700 border-green-200', emoji: '✨' },
];

const TEMPLATES: Record<TicketType, string> = {
  bug: `<h3>Description du bug</h3><p>Décrivez clairement le problème rencontré.</p><h3>Étapes pour reproduire</h3><ol><li>Aller sur...</li><li>Cliquer sur...</li><li>Observer...</li></ol><h3>Comportement attendu</h3><p>Que devrait-il se passer ?</p><h3>Comportement actuel</h3><p>Que se passe-t-il à la place ?</p>`,
  question: `<h3>Ma question</h3><p>Quelle est votre question ?</p><h3>Contexte</h3><p>Donnez un peu de contexte pour mieux comprendre votre question.</p>`,
  improvement: `<h3>Description de l'amélioration</h3><p>Décrivez l'amélioration souhaitée.</p><h3>Pourquoi ?</h3><p>En quoi cette amélioration serait-elle utile ?</p><h3>Suggestion de solution</h3><p>Avez-vous une idée de comment ça pourrait fonctionner ?</p>`,
};

interface TicketFormProps {
  open: boolean;
  onClose: () => void;
}

export function TicketForm({ open, onClose }: TicketFormProps) {
  const navigate = useNavigate();
  const createTicket = useTicketStore((s) => s.createTicket);

  const [type, setType] = useState<TicketType>('bug');
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<TicketVisibility>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [confirmTypeChange, setConfirmTypeChange] = useState<TicketType | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Décrivez votre retour...' }),
      Link.configure({ openOnClick: false }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4 mx-auto block',
        },
      }),
    ],
    content: TEMPLATES[type],
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

  const isContentDefault = useCallback(() => {
    if (!editor) return true;
    const currentContent = editor.getHTML();
    return currentContent === TEMPLATES[type];
  }, [editor, type]);

  const handleTypeChange = (newType: TicketType) => {
    if (newType === type) return;
    if (editor && !isContentDefault()) {
      setConfirmTypeChange(newType);
    } else {
      setType(newType);
      editor?.commands.setContent(TEMPLATES[newType]);
    }
  };

  const confirmChangeType = () => {
    if (confirmTypeChange) {
      setType(confirmTypeChange);
      editor?.commands.setContent(TEMPLATES[confirmTypeChange]);
      setConfirmTypeChange(null);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !editor) return;
    setIsSubmitting(true);
    try {
      const ticket = await createTicket({
        type,
        title: title.trim(),
        description: editor.getHTML(),
        visibility,
      });
      setCreatedTicketId(ticket.id);
      setShowSuccess(true);
    } catch {
      // Error handled by store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setType('bug');
    setVisibility('public');
    setShowSuccess(false);
    setCreatedTicketId(null);
    editor?.commands.setContent(TEMPLATES.bug);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-parchment-200">
          <h2 className="text-lg font-display font-bold text-ink-500">
            {showSuccess ? 'Ticket créé !' : 'Nouveau ticket'}
          </h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {showSuccess ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-ink-500 mb-2">Votre ticket a été créé avec succès !</p>
            <p className="text-sm text-ink-300 mb-6">
              Merci pour votre retour. Nous le traiterons dès que possible.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  handleClose();
                  if (createdTicketId) navigate('/tickets');
                }}
                className="btn-primary"
              >
                Voir les tickets
              </button>
              <button onClick={handleClose} className="btn-secondary">
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Type */}
            <div>
              <label className="label-field">Type *</label>
              <div className="flex gap-2">
                {TICKET_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleTypeChange(t.value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                      type === t.value
                        ? t.color + ' ring-2 ring-offset-1 ring-current'
                        : 'bg-parchment-50 text-ink-300 border-parchment-200 hover:border-parchment-400'
                    )}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="label-field">Titre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Résumez votre retour en quelques mots..."
                className="input-field"
                maxLength={200}
              />
            </div>

            {/* Description (TipTap) */}
            <div>
              <label className="label-field">Description *</label>
              <div className="border border-parchment-300 rounded-lg overflow-hidden">
                {/* Toolbar */}
                {editor && (
                  <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-parchment-200 bg-parchment-50">
                    <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Titre 1">
                      <Heading1 size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre 2">
                      <Heading2 size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Titre 3">
                      <Heading3 size={15} />
                    </ToolbarButton>
                    <div className="w-px bg-parchment-300 mx-1 h-5" />
                    <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
                      <Bold size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
                      <Italic size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné">
                      <UnderlineIcon size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré">
                      <Strikethrough size={15} />
                    </ToolbarButton>
                    <div className="w-px bg-parchment-300 mx-1 h-5" />
                    <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Aligner à gauche">
                      <AlignLeft size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrer">
                      <AlignCenter size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Aligner à droite">
                      <AlignRight size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justifier">
                      <AlignJustify size={15} />
                    </ToolbarButton>
                    <div className="w-px bg-parchment-300 mx-1 h-5" />
                    <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces">
                      <List size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
                      <ListOrdered size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citation">
                      <Quote size={15} />
                    </ToolbarButton>
                    <div className="w-px bg-parchment-300 mx-1 h-5" />
                    <ToolbarButton active={false} onClick={addImage} title="Insérer une image">
                      <ImagePlus size={15} />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('link')} onClick={toggleLink} title={editor.isActive('link') ? 'Retirer le lien' : 'Ajouter un lien'}>
                      {editor.isActive('link') ? <Unlink size={15} /> : <LinkIcon size={15} />}
                    </ToolbarButton>
                    <div className="w-px bg-parchment-300 mx-1 h-5" />
                    <ToolbarButton active={false} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Supprimer le formatage">
                      <RemoveFormatting size={15} />
                    </ToolbarButton>
                  </div>
                )}
                <EditorContent
                  editor={editor}
                  className="prose prose-sm max-w-none p-4 min-h-[200px] focus-within:ring-2 focus-within:ring-gold-400 rounded-b-lg"
                />
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="label-field">Visibilité</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                    className="text-bordeaux-500 focus:ring-bordeaux-400"
                  />
                  <span className="text-sm text-ink-400">Publique</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                    className="text-bordeaux-500 focus:ring-bordeaux-400"
                  />
                  <span className="text-sm text-ink-400">Privé</span>
                </label>
              </div>
              <p className="text-xs text-ink-200 mt-1">
                {visibility === 'public'
                  ? 'Visible par tous les utilisateurs'
                  : 'Visible uniquement par vous et les administrateurs'}
              </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleClose} className="btn-secondary">
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || isSubmitting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}

        {/* Confirm type change dialog */}
        <ConfirmDialog
          open={confirmTypeChange !== null}
          title="Changer le type ?"
          description="Vous avez modifié la description. Changer le type remplacera le texte par le nouveau template. Continuer ?"
          confirmLabel="Oui, changer"
          onConfirm={confirmChangeType}
          onCancel={() => setConfirmTypeChange(null)}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
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
        'w-8 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors',
        active ? 'bg-bordeaux-100 text-bordeaux-600' : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
      )}
    >
      {children}
    </button>
  );
}
