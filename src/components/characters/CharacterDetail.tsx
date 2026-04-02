import { useState } from 'react';
import { ArrowLeft, Edit, Trash2, Plus, User, Heart, Swords, Users as UsersIcon, X, Pencil, BookText } from 'lucide-react';
import type { Character, Relationship } from '@/types';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { RELATIONSHIP_TYPE_LABELS, FAMILY_ROLE_LABELS } from '@/lib/utils';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CharacterAvatar } from './CharacterAvatar';
import { RelationshipEditor } from './RelationshipEditor';
import { useNavigate } from 'react-router-dom';

interface CharacterDetailProps {
  character: Character;
  onBack: () => void;
  onEdit: () => void;
}

const SEX_LABELS: Record<string, string> = {
  male: 'Homme',
  female: 'Femme',
};

function getRelLabel(rel: Relationship): string {
  if (rel.type === 'custom') return rel.customType ?? 'Autre';
  if (rel.type === 'family' && rel.familyRoleTarget) {
    return `Famille (${FAMILY_ROLE_LABELS[rel.familyRoleTarget] ?? rel.familyRoleTarget})`;
  }
  return RELATIONSHIP_TYPE_LABELS[rel.type] ?? rel.type;
}

export function CharacterDetail({ character, onBack, onEdit }: CharacterDetailProps) {
  const navigate = useNavigate();
  const { characters, deleteCharacter, deleteRelationship } = useEncyclopediaStore();
  const [showDelete, setShowDelete] = useState(false);
  const [showRelEditor, setShowRelEditor] = useState(false);
  const [editingRel, setEditingRel] = useState<Relationship | undefined>(undefined);
  const [deleteRelTarget, setDeleteRelTarget] = useState<{ relId: string; targetName: string } | null>(null);

  const handleDelete = () => {
    deleteCharacter(character.id);
    navigate('/characters');
  };

  const handleDeleteRelationship = () => {
    if (!deleteRelTarget) return;
    deleteRelationship(character.id, deleteRelTarget.relId);
    setDeleteRelTarget(null);
  };

  const openEditRelation = (rel: Relationship) => {
    setEditingRel(rel);
    setShowRelEditor(true);
  };

  const openNewRelation = () => {
    setEditingRel(undefined);
    setShowRelEditor(true);
  };

  return (
    <div className="page-container max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <button onClick={onEdit} className="btn-secondary flex items-center gap-2">
          <Edit className="w-4 h-4" /> Modifier
        </button>
        <button onClick={() => setShowDelete(true)} className="btn-ghost text-red-500 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Header */}
      <div className="card-fantasy p-6 mb-6">
        <div className="flex gap-6">
          <CharacterAvatar
            imageUrl={character.imageUrl}
            imageOffsetY={character.imageOffsetY}
            name={character.name}
            size={32}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-3xl font-bold text-ink-500">
                {character.name} {character.surname}
              </h2>
              {character.inGlossary && (
                <BookText className="w-5 h-5 text-bordeaux-400 flex-shrink-0" />
              )}
            </div>
            {character.nickname && (
              <p className="text-lg text-ink-300 italic mt-1">"{character.nickname}"</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-ink-300">
              {character.sex && (
                <span className="badge bg-parchment-200 text-ink-400">{SEX_LABELS[character.sex]}</span>
              )}
              {character.age !== undefined && character.age !== null && (
                <span className="badge bg-parchment-200 text-ink-400">{character.age} ans</span>
              )}
              {character.profession && (
                <span className="text-bordeaux-500 font-medium">{character.profession}</span>
              )}
            </div>
            {character.lifeGoal && (
              <p className="text-sm text-ink-300 mt-2">
                <span className="font-medium">But :</span> {character.lifeGoal}
              </p>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              {character.qualities.map((q, i) => (
                <span key={i} className="badge bg-green-50 text-green-700">{q}</span>
              ))}
              {character.flaws.map((f, i) => (
                <span key={i} className="badge bg-red-50 text-red-700">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Description & Personality */}
      {(character.description || character.personality) && (
        <div className="card-fantasy p-6 mb-6 space-y-4">
          {character.description && (
            <div>
              <h4 className="font-display font-semibold text-ink-400 mb-2">Description</h4>
              <p className="text-ink-300 font-serif whitespace-pre-wrap">{character.description}</p>
            </div>
          )}
          {character.personality && (
            <div>
              <h4 className="font-display font-semibold text-ink-400 mb-2">Caractere</h4>
              <p className="text-ink-300 font-serif whitespace-pre-wrap">{character.personality}</p>
            </div>
          )}
        </div>
      )}

      {/* Skills, Likes, Dislikes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {character.skills.length > 0 && (
          <div className="card-fantasy p-4">
            <h4 className="font-display font-semibold text-ink-400 mb-2">Competences</h4>
            <div className="flex flex-wrap gap-1">
              {character.skills.map((s, i) => (
                <span key={i} className="badge bg-blue-50 text-blue-700">{s}</span>
              ))}
            </div>
          </div>
        )}
        {character.likes.length > 0 && (
          <div className="card-fantasy p-4">
            <h4 className="font-display font-semibold text-ink-400 mb-2 flex items-center gap-1">
              <Heart className="w-4 h-4 text-bordeaux-500" /> Aime
            </h4>
            <ul className="text-sm text-ink-300 space-y-1">
              {character.likes.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        )}
        {character.dislikes.length > 0 && (
          <div className="card-fantasy p-4">
            <h4 className="font-display font-semibold text-ink-400 mb-2 flex items-center gap-1">
              <Swords className="w-4 h-4 text-ink-300" /> N'aime pas
            </h4>
            <ul className="text-sm text-ink-300 space-y-1">
              {character.dislikes.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Evolution */}
      {(character.evolution.beforeStory || character.evolution.duringStory || character.evolution.endOfStory) && (
        <div className="card-fantasy p-6 mb-6">
          <h4 className="font-display font-semibold text-ink-400 mb-4">Arc narratif</h4>
          <div className="relative pl-6 border-l-2 border-gold-400 space-y-6">
            {character.evolution.beforeStory && (
              <div>
                <div className="absolute -left-2 w-4 h-4 rounded-full bg-parchment-300 border-2 border-gold-400" />
                <h5 className="text-sm font-medium text-gold-600">Avant l'histoire</h5>
                <p className="text-sm text-ink-300 font-serif mt-1">{character.evolution.beforeStory}</p>
              </div>
            )}
            {character.evolution.duringStory && (
              <div>
                <div className="absolute -left-2 w-4 h-4 rounded-full bg-gold-400 border-2 border-gold-400" />
                <h5 className="text-sm font-medium text-gold-600">Pendant l'histoire</h5>
                <p className="text-sm text-ink-300 font-serif mt-1">{character.evolution.duringStory}</p>
              </div>
            )}
            {character.evolution.endOfStory && (
              <div>
                <div className="absolute -left-2 w-4 h-4 rounded-full bg-bordeaux-500 border-2 border-bordeaux-500" />
                <h5 className="text-sm font-medium text-bordeaux-500">Fin de l'histoire</h5>
                <p className="text-sm text-ink-300 font-serif mt-1">{character.evolution.endOfStory}</p>
              </div>
            )}
          </div>
          {character.evolution.initiationJourney && (
            <div className="mt-4 pt-4 border-t border-parchment-200">
              <h5 className="text-sm font-medium text-ink-400">Chemin initiatique</h5>
              <p className="text-sm text-ink-300 font-serif mt-1">{character.evolution.initiationJourney}</p>
            </div>
          )}
        </div>
      )}

      {/* Key Events */}
      {character.keyEvents.length > 0 && (
        <div className="card-fantasy p-6 mb-6">
          <h4 className="font-display font-semibold text-ink-400 mb-3">Evenements marquants</h4>
          <div className="space-y-3">
            {character.keyEvents.map((ev) => (
              <div key={ev.id} className="bg-parchment-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium text-ink-500">{ev.title}</h5>
                  {ev.date && <span className="text-xs text-ink-200">{ev.date}</span>}
                </div>
                {ev.description && <p className="text-sm text-ink-300 mt-1">{ev.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      <div className="card-fantasy p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-semibold text-ink-400 flex items-center gap-2">
            <UsersIcon className="w-5 h-5" /> Relations
          </h4>
          <button onClick={openNewRelation} className="btn-ghost text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>
        {character.relationships.length === 0 ? (
          <p className="text-sm text-ink-200 italic">Aucune relation definie</p>
        ) : (
          <div className="space-y-2">
            {character.relationships.map((rel) => {
              const target = characters.find((c) => c.id === rel.targetCharacterId);
              return (
                <div
                  key={rel.id}
                  className="bg-parchment-100 rounded-lg p-3 group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex items-start gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity min-w-0"
                      onClick={() => target && navigate(`/characters/${target.id}`)}
                    >
                      <CharacterAvatar
                        imageUrl={target?.imageUrl}
                        imageOffsetY={target?.imageOffsetY}
                        name={target?.name ?? 'Inconnu'}
                        size={8}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-ink-500">{target?.name ?? 'Inconnu'}</span>
                          <span className="text-xs text-bordeaux-500">
                            {getRelLabel(rel)}
                          </span>
                        </div>
                        {rel.description && (
                          <p className="text-xs text-ink-300 mt-1 whitespace-pre-wrap">{rel.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => openEditRelation(rel)}
                        className="p-1.5 rounded-lg text-ink-200 hover:text-ink-500 hover:bg-parchment-200"
                        title="Modifier la relation"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteRelTarget({ relId: rel.id, targetName: target?.name ?? 'Inconnu' })}
                        className="p-1.5 rounded-lg text-ink-200 hover:text-red-500 hover:bg-red-50"
                        title="Supprimer la relation"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      {character.notes && (
        <div className="card-fantasy p-6 mb-6">
          <h4 className="font-display font-semibold text-ink-400 mb-2">Notes</h4>
          <p className="text-sm text-ink-300 font-serif whitespace-pre-wrap">{character.notes}</p>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Supprimer le personnage"
        description={`Etes-vous sur de vouloir supprimer ${character.name} ? Cette action est irreversible.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      <ConfirmDialog
        open={deleteRelTarget !== null}
        title="Supprimer la relation"
        description={`Supprimer la relation avec ${deleteRelTarget?.targetName ?? ''} ?`}
        onConfirm={handleDeleteRelationship}
        onCancel={() => setDeleteRelTarget(null)}
      />

      {showRelEditor && (
        <RelationshipEditor
          characterId={character.id}
          existingRelationship={editingRel}
          onClose={() => { setShowRelEditor(false); setEditingRel(undefined); }}
        />
      )}
    </div>
  );
}
