import { useState, useCallback } from 'react';
import { Plus, Lightbulb, Edit, Trash2, X, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { NoteIdea } from '@/types';

export function NotesIdeasPage() {
  const noteIdeas = useBookStore((s) => s.noteIdeas ?? []);
  const addNoteIdea = useBookStore((s) => s.addNoteIdea);
  const deleteNoteIdea = useBookStore((s) => s.deleteNoteIdea);
  const reorderNoteIdeas = useBookStore((s) => s.reorderNoteIdeas);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sorted = [...noteIdeas].sort((a, b) => a.order - b.order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((n) => n.id === active.id);
    const newIndex = sorted.findIndex((n) => n.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderNoteIdeas(reordered.map((n) => n.id));
  }, [sorted, reorderNoteIdeas]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

      {sorted.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Aucune note"
          description="Notez vos idées, passages inspirants, checklists et réflexions en vrac."
          action={<button onClick={() => setShowForm(true)} className="btn-primary">Créer une note</button>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sorted.map((note) => (
                <SortableNoteCard
                  key={note.id}
                  note={note}
                  expanded={expandedIds.has(note.id)}
                  onToggleExpand={() => toggleExpand(note.id)}
                  onEdit={() => { setEditingId(note.id); setShowForm(true); }}
                  onDelete={() => setDeleteId(note.id)}
                />
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

function SortableNoteCard({
  note, expanded, onToggleExpand, onEdit, onDelete,
}: {
  note: NoteIdea;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // strip html for preview
  const preview = note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <div ref={setNodeRef} style={style} className="card-fantasy overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-parchment-100 transition-colors"
        onClick={onToggleExpand}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-ink-100 hover:text-ink-300 flex-shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-ink-300" /> : <ChevronRight className="w-4 h-4 text-ink-300" />}
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-ink-500 text-sm">{note.title}</h3>
          {!expanded && preview && (
            <p className="text-xs text-ink-300 mt-0.5 line-clamp-1">{preview}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="btn-ghost p-1"><Edit className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="btn-ghost p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {expanded && note.content && (
        <div className="px-4 pb-4 pl-14">
          <div
            className="prose prose-sm max-w-none text-ink-400 font-serif
              [&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0
              [&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-start [&_ul[data-type='taskList']_li]:gap-2
              [&_ul[data-type='taskList']_li_label]:mt-0.5
              [&_ul[data-type='taskList']_li_input]:mt-1"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        </div>
      )}
    </div>
  );
}

function NoteIdeaForm({ noteId, onClose }: { noteId: string | null; onClose: () => void }) {
  const noteIdeas = useBookStore((s) => s.noteIdeas ?? []);
  const addNoteIdea = useBookStore((s) => s.addNoteIdea);
  const updateNoteIdea = useBookStore((s) => s.updateNoteIdea);
  const existing = noteId ? noteIdeas.find((n) => n.id === noteId) : null;

  const [title, setTitle] = useState(existing?.title ?? '');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Notez votre idée ici...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: existing?.content ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] text-ink-400 font-serif',
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const content = editor?.getHTML() ?? '';

    if (existing) {
      updateNoteIdea(existing.id, { title, content });
    } else {
      addNoteIdea({ title, content });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 my-4">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300">
          <h3 className="font-display text-xl font-bold text-ink-500">
            {existing ? 'Modifier la note' : 'Nouvelle note'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label-field">Titre *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              required
              placeholder="Mon idée..."
            />
          </div>

          <div>
            <label className="label-field">Contenu</label>
            <div className="border border-parchment-300 rounded-lg overflow-hidden bg-white">
              {/* Mini toolbar */}
              {editor && (
                <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-parchment-200 bg-parchment-50 flex-wrap">
                  <TBtn
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Gras"
                  >B</TBtn>
                  <TBtn
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italique"
                  ><em>I</em></TBtn>
                  <Sep />
                  <TBtn
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Liste"
                  >•</TBtn>
                  <TBtn
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Liste numérotée"
                  >1.</TBtn>
                  <TBtn
                    active={editor.isActive('taskList')}
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    title="Checklist"
                  >☑</TBtn>
                  <Sep />
                  <TBtn
                    active={editor.isActive('blockquote')}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title="Citation"
                  >❝</TBtn>
                </div>
              )}
              <div className="p-3">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-parchment-300">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{existing ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-bordeaux-100 text-bordeaux-600'
          : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-parchment-300 mx-0.5" />;
}
