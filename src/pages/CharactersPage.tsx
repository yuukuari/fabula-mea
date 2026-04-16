import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Users, Search, GripVertical } from 'lucide-react';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { CharacterCard } from '@/components/characters/CharacterCard';
import { CharacterDetail } from '@/components/characters/CharacterDetail';
import { CharacterForm } from '@/components/characters/CharacterForm';
import { RelationshipGraph } from '@/components/characters/RelationshipGraph';
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
import type { Character } from '@/types';

type CharacterFilter = 'all' | 'book' | 'genealogy';

function SortableCharacterCard({ character, onClick }: { character: Character; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: character.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sort">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-10 p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-100 opacity-0 group-hover/sort:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <CharacterCard character={character} onClick={onClick} />
    </div>
  );
}

export function CharactersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { characters, reorderCharacters } = useEncyclopediaStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CharacterFilter>('all');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const hasGenealogyOnly = useMemo(
    () => characters.some((c) => c.hideFromRelationshipGraph),
    [characters],
  );

  const genealogyCount = useMemo(
    () => characters.filter((c) => c.hideFromRelationshipGraph).length,
    [characters],
  );

  const bookCount = useMemo(
    () => characters.filter((c) => !c.hideFromRelationshipGraph).length,
    [characters],
  );

  const visibleCharacters = useMemo(() => {
    if (filter === 'book') return characters.filter((c) => !c.hideFromRelationshipGraph);
    if (filter === 'genealogy') return characters.filter((c) => c.hideFromRelationshipGraph);
    return characters;
  }, [characters, filter]);

  const sorted = useMemo(
    () => [...visibleCharacters].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [visibleCharacters],
  );

  const filtered = sorted.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.surname?.toLowerCase().includes(search.toLowerCase()) ||
    c.profession?.toLowerCase().includes(search.toLowerCase())
  );

  const isSearchingOrFiltering = search.length > 0 || filter !== 'all';

  const selectedChar = id ? characters.find((c) => c.id === id) : null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((c) => c.id === active.id);
    const newIndex = sorted.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderCharacters(reordered.map((c) => c.id));
  }

  // Form modal — always rendered on top regardless of list/detail view
  const formModal = showForm && (
    <CharacterForm
      characterId={editingId}
      onClose={() => { setShowForm(false); setEditingId(null); }}
    />
  );

  if (selectedChar) {
    return (
      <>
        <CharacterDetail
          character={selectedChar}
          onBack={() => navigate('/characters')}
          onEdit={() => { setEditingId(selectedChar.id); setShowForm(true); }}
        />
        {formModal}
      </>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Personnages</h2>
        <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau personnage</span>
        </button>
      </div>

      {characters.length > 0 && hasGenealogyOnly && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`badge cursor-pointer ${filter === 'all' ? 'bg-bordeaux-500 text-white' : 'bg-parchment-200 text-ink-400'}`}
          >
            Tous ({characters.length})
          </button>
          <button
            onClick={() => setFilter('book')}
            className={`badge cursor-pointer ${filter === 'book' ? 'bg-bordeaux-500 text-white' : 'bg-parchment-200 text-ink-400'}`}
          >
            Livre ({bookCount})
          </button>
          <button
            onClick={() => setFilter('genealogy')}
            className={`badge cursor-pointer ${filter === 'genealogy' ? 'bg-bordeaux-500 text-white' : 'bg-parchment-200 text-ink-400'}`}
          >
            Généalogie ({genealogyCount})
          </button>
        </div>
      )}

      {characters.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-200" />
          <input
            type="text"
            placeholder="Rechercher un personnage..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {characters.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun personnage"
          description="Commencez par créer les personnages de votre histoire. Donnez-leur vie avec une description riche, des qualités, des défauts et des relations."
          action={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Créer un personnage
            </button>
          }
        />
      ) : (
        <>
          {isSearchingOrFiltering ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  onClick={() => navigate(`/characters/${char.id}`)}
                />
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sorted.map((c) => c.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sorted.map((char) => (
                    <SortableCharacterCard
                      key={char.id}
                      character={char}
                      onClick={() => navigate(`/characters/${char.id}`)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Relationship Graph */}
          <div className="mt-8">
            <RelationshipGraph />
          </div>
        </>
      )}

      {formModal}
    </div>
  );
}
