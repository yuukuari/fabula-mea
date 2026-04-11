import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { GenealogyGraph } from './GenealogyGraph';
import { GenealogyEditModal } from './GenealogyEditModal';

export function GenealogyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { characters } = useEncyclopediaStore();

  const [centerId, setCenterId] = useState(id ?? '');
  const [editCharId, setEditCharId] = useState<string | null>(null);

  const character = characters.find((c) => c.id === centerId);
  const centerName = character
    ? (character.surname ? `${character.name} ${character.surname}` : character.name)
    : '';

  // Click on a node → recenter graph on that character
  const handleNodeClick = useCallback((characterId: string) => {
    setCenterId(characterId);
  }, []);

  // Edit icon on center character → open modal
  const handleEditNode = useCallback((characterId: string) => {
    setEditCharId(characterId);
  }, []);

  const handleRecenter = useCallback((characterId: string) => {
    setCenterId(characterId);
    setEditCharId(null);
  }, []);

  if (!id) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-parchment-200 bg-white/50">
        <button
          onClick={() => navigate(`/characters/${id}`)}
          className="p-1.5 rounded-lg hover:bg-parchment-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>
        <GitBranch className="w-5 h-5 text-bordeaux-400" />
        <h1 className="font-display text-lg text-ink-500">
          Arbre généalogique
          {centerName && <span className="text-ink-300 ml-1.5">— {centerName}</span>}
        </h1>
      </div>

      {/* Graph */}
      <GenealogyGraph
        centerId={centerId}
        characters={characters}
        onNodeClick={handleNodeClick}
        onEditNode={handleEditNode}
      />

      {/* Edit modal */}
      {editCharId && (
        <GenealogyEditModal
          characterId={editCharId}
          centerId={centerId}
          onClose={() => setEditCharId(null)}
          onRecenter={handleRecenter}
        />
      )}
    </div>
  );
}
