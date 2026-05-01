import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus, Lightbulb, Edit, Trash2, X, ArrowLeft, ListChecks, Search, GripVertical, Sparkles,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Heading3, Quote, List, ListOrdered,
  ImagePlus, Link as LinkIcon, Unlink, RemoveFormatting,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WORLD_NOTE_CATEGORY_LABELS } from '@/lib/utils';
import type { WorldNoteCategory } from '@/types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExt from '@tiptap/extension-link';
import ImageExt from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useSearchParams } from 'react-router-dom';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { NoteIdea } from '@/types';

function SortableNoteIdeaCard({ note, onClick }: { note: NoteIdea; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: note.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sort">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-10 p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-100 opacity-0 group-hover/sort:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <NoteIdeaCard note={note} onClick={onClick} />
    </div>
  );
}

function NoteIdeaCard({ note, onClick }: { note: NoteIdea; onClick: () => void }) {
  const plainText = note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const totalMatch = note.content.match(/data-type="taskItem"/g);
  const checkedMatch = note.content.match(/data-checked="true"/g);
  const checklistTotal = totalMatch?.length ?? 0;
  const checklistChecked = checkedMatch?.length ?? 0;

  return (
    <div onClick={onClick} className="card-fantasy cursor-pointer overflow-hidden">
      <div className="p-4">
        {note.title && (
          <h3 className="font-display font-bold text-ink-500 mb-2">{note.title}</h3>
        )}
        {plainText && (
          <div
            className="tiptap text-sm text-ink-300 overflow-hidden font-serif leading-relaxed max-h-36 relative"
            style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        )}
        {!plainText && !note.title && (
          <p className="text-sm text-ink-200 italic">Note vide</p>
        )}
        {checklistTotal > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-parchment-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-bordeaux-400 rounded-full transition-all"
                style={{ width: `${Math.round((checklistChecked / checklistTotal) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-ink-300 whitespace-nowrap">
              {checklistChecked}/{checklistTotal}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotesIdeasPage() {
  const [searchParams] = useSearchParams();
  const noteIdeas = useBookStore((s) => s.noteIdeas ?? []);
  const addNoteIdea = useBookStore((s) => s.addNoteIdea);
  const deleteNoteIdea = useBookStore((s) => s.deleteNoteIdea);
  const reorderNoteIdeas = useBookStore((s) => s.reorderNoteIdeas);
  const addWorldNote = useBookStore((s) => s.addWorldNote);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('noteId')
  );

  useEffect(() => {
    const id = searchParams.get('noteId');
    if (id) setSelectedId(id);
  }, [searchParams]);

  const [search, setSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sorted = useMemo(
    () => [...noteIdeas].sort((a, b) => a.order - b.order),
    [noteIdeas],
  );

  const filtered = sorted.filter((n) =>
    !search || (n.title ?? '').toLowerCase().includes(search.toLowerCase()) || n.content.replace(/<[^>]*>/g, ' ').toLowerCase().includes(search.toLowerCase())
  );

  const isSearching = search.length > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((n) => n.id === active.id);
    const newIndex = sorted.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderNoteIdeas(reordered.map((n) => n.id));
  }

  const selectedNote = selectedId ? noteIdeas.find((n) => n.id === selectedId) : null;

  // ─── Detail view ───
  if (selectedNote) {
    const preview = selectedNote.content;
    return (
      <div className="page-container max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedId(null)} className="btn-ghost p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setConvertId(selectedNote.id)}
            className="btn-secondary flex items-center gap-2"
            title="Transformer cette note en fiche univers"
          >
            <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">Transformer en fiche univers</span>
          </button>
          <button
            onClick={() => { setEditingId(selectedNote.id); setShowForm(true); }}
            className="btn-secondary flex items-center gap-2"
          >
            <Edit className="w-4 h-4" /> Modifier
          </button>
          <button onClick={() => setDeleteId(selectedNote.id)} className="btn-ghost text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="card-fantasy p-6">
          {selectedNote.title && (
            <h2 className="font-display text-2xl font-bold text-ink-500 mb-4">{selectedNote.title}</h2>
          )}
          {preview && (
            <div
              className="tiptap text-ink-400 font-serif leading-relaxed"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          )}
        </div>

        <ConfirmDialog
          open={!!deleteId}
          title="Supprimer la note"
          description="Cette action est irréversible."
          onConfirm={() => { if (deleteId) { deleteNoteIdea(deleteId); setSelectedId(null); } setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
        {showForm && (
          <NoteIdeaForm
            noteId={editingId}
            onClose={() => { setShowForm(false); setEditingId(null); }}
          />
        )}
        {convertId && (
          <ConvertToWorldNoteModal
            note={selectedNote}
            onCancel={() => setConvertId(null)}
            onConfirm={(title, category) => {
              const plainContent = tiptapHtmlToPlainText(selectedNote.content);
              const newId = addWorldNote({ title, category, content: plainContent });
              deleteNoteIdea(selectedNote.id);
              setConvertId(null);
              setSelectedId(null);
              navigate(`/world?noteId=${newId}`);
            }}
          />
        )}
      </div>
    );
  }

  // ─── Card grid view ───
  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Notes & Idées</h2>
        <button
          onClick={() => { setEditingId(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouvelle note</span>
        </button>
      </div>

      {noteIdeas.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-200" />
          <input
            type="text"
            placeholder="Rechercher une note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {filtered.length === 0 && !search ? (
        <EmptyState
          icon={Lightbulb}
          title="Aucune note"
          description="Notez vos idées, vos recherches, passages inspirants, checklists et réflexions en vrac."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Créer une note</button>}
        />
      ) : isSearching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <NoteIdeaCard key={note.id} note={note} onClick={() => setSelectedId(note.id)} />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((note) => (
                <SortableNoteIdeaCard key={note.id} note={note} onClick={() => setSelectedId(note.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showForm && (
        <NoteIdeaForm
          noteId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer la note"
        description="Cette action est irréversible."
        onConfirm={() => { if (deleteId) deleteNoteIdea(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Form modal with full toolbar ───
function NoteIdeaForm({ noteId, onClose }: { noteId: string | null; onClose: () => void }) {
  const noteIdeas = useBookStore((s) => s.noteIdeas ?? []);
  const addNoteIdea = useBookStore((s) => s.addNoteIdea);
  const updateNoteIdea = useBookStore((s) => s.updateNoteIdea);
  const existing = noteId ? noteIdeas.find((n) => n.id === noteId) : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Notez votre idée ici...' }),
      LinkExt.configure({ openOnClick: false }),
      ImageExt,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: existing?.content ?? '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm max-w-none focus:outline-none min-h-[200px] text-ink-400 font-serif',
      },
    },
  });

  const addImage = useCallback(() => {
    const url = window.prompt("URL de l'image :");
    if (url && editor) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const toggleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt('URL du lien :');
      if (url) editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const isDirty = useCallback(() => {
    const content = editor?.getHTML() ?? '';
    if (!existing) {
      const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return !!(title || plainText);
    }
    return title !== (existing.title ?? '') || content !== (existing.content ?? '');
  }, [title, editor, existing]);

  const handleSave = () => {
    const content = editor?.getHTML() ?? '';
    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plainText) return;
    if (existing) {
      updateNoteIdea(existing.id, { title, content });
    } else {
      addNoteIdea({ title, content });
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-3xl mx-4 my-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300 flex-shrink-0">
          <h3 className="font-display text-xl font-bold text-ink-500">
            {existing ? 'Modifier la note' : 'Nouvelle note'}
          </h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="label-field">Titre</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="Titre (facultatif)"
            />
          </div>

          <div>
            <label className="label-field">Contenu *</label>
            <div className="border border-parchment-300 rounded-lg overflow-hidden bg-white">
              {/* Full toolbar */}
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
                  <Sep />
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
                  <Sep />
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
                  <Sep />
                  <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces">
                    <List size={15} />
                  </ToolbarButton>
                  <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
                    <ListOrdered size={15} />
                  </ToolbarButton>
                  <ToolbarButton active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
                    <ListChecks size={15} />
                  </ToolbarButton>
                  <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citation">
                    <Quote size={15} />
                  </ToolbarButton>
                  <Sep />
                  <ToolbarButton active={false} onClick={addImage} title="Insérer une image">
                    <ImagePlus size={15} />
                  </ToolbarButton>
                  <ToolbarButton active={editor.isActive('link')} onClick={toggleLink} title={editor.isActive('link') ? 'Retirer le lien' : 'Ajouter un lien'}>
                    {editor.isActive('link') ? <Unlink size={15} /> : <LinkIcon size={15} />}
                  </ToolbarButton>
                  <Sep />
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

          </div>
          <div className="flex justify-end gap-3 p-6 border-t border-parchment-300 flex-shrink-0">
            <button type="button" onClick={handleClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>

      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnsavedConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Modifications non enregistrées</h3>
            <p className="text-sm text-ink-300 mb-6">Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUnsavedConfirm(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={() => { setShowUnsavedConfirm(false); onClose(); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-400 hover:bg-parchment-100 transition-colors">Quitter</button>
              <button onClick={() => { setShowUnsavedConfirm(false); handleSave(); }} className="btn-primary text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared toolbar components ───
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
      type="button"
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

function Sep() {
  return <div className="w-px bg-parchment-300 mx-1 h-5" />;
}

function tiptapHtmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Convert to world note modal ───
function ConvertToWorldNoteModal({
  note,
  onCancel,
  onConfirm,
}: {
  note: NoteIdea;
  onCancel: () => void;
  onConfirm: (title: string, category: WorldNoteCategory) => void;
}) {
  const [title, setTitle] = useState(note.title ?? '');
  const [category, setCategory] = useState<WorldNoteCategory>('custom');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Le titre est obligatoire pour une fiche univers.');
      return;
    }
    onConfirm(trimmed, category);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300">
          <h3 className="font-display text-xl font-bold text-ink-500">Transformer en fiche univers</h3>
          <button onClick={onCancel} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-ink-300">
              La note actuelle sera <strong>supprimée</strong> et son contenu transféré dans une nouvelle fiche univers. Cette action est irréversible.
            </p>
            <div>
              <label className="label-field">Titre *</label>
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (error) setError(null); }}
                className="input-field"
                placeholder="Titre de la fiche univers"
                autoFocus
              />
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>
            <div>
              <label className="label-field">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WorldNoteCategory)}
                className="input-field"
              >
                {Object.entries(WORLD_NOTE_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 p-6 border-t border-parchment-300">
            <button type="button" onClick={onCancel} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">Transformer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
