import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Users, Search } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import { CharacterCard } from '@/components/characters/CharacterCard';
import { CharacterDetail } from '@/components/characters/CharacterDetail';
import { CharacterForm } from '@/components/characters/CharacterForm';
import { RelationshipGraph } from '@/components/characters/RelationshipGraph';

export function CharactersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const characters = useBookStore((s) => s.characters);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.surname?.toLowerCase().includes(search.toLowerCase()) ||
    c.profession?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedChar = id ? characters.find((c) => c.id === id) : null;

  if (selectedChar) {
    return (
      <CharacterDetail
        character={selectedChar}
        onBack={() => navigate('/characters')}
        onEdit={() => { setEditingId(selectedChar.id); setShowForm(true); }}
      />
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Personnages</h2>
        <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouveau personnage
        </button>
      </div>

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
          description="Commencez par creer les personnages de votre histoire. Donnez-leur vie avec une description riche, des qualites, des defauts et des relations."
          action={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Creer un personnage
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                onClick={() => navigate(`/characters/${char.id}`)}
              />
            ))}
          </div>

          {/* Relationship Graph */}
          <div className="mt-8">
            <RelationshipGraph />
          </div>
        </>
      )}

      {showForm && (
        <CharacterForm
          characterId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}
