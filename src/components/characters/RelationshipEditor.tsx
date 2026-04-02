import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { RELATIONSHIP_TYPE_LABELS, FAMILY_ROLE_LABELS, ALWAYS_RECIPROCAL_TYPES } from '@/lib/utils';
import type { RelationshipType, Relationship } from '@/types';

interface RelationshipEditorProps {
  characterId: string;
  /** If provided, we are editing an existing relationship */
  existingRelationship?: Relationship;
  onClose: () => void;
}

// Get the reverse family role, adjusted by target sex
function getReverseFamilyRole(role: string, targetSex?: string): string {
  const map: Record<string, Record<string, string>> = {
    pere: { male: 'fils', female: 'fille', default: 'fils' },
    mere: { male: 'fils', female: 'fille', default: 'fils' },
    fils: { male: 'pere', female: 'mere', default: 'pere' },
    fille: { male: 'pere', female: 'mere', default: 'pere' },
    frere: { male: 'frere', female: 'soeur', default: 'frere' },
    soeur: { male: 'frere', female: 'soeur', default: 'soeur' },
    oncle: { male: 'neveu', female: 'niece', default: 'neveu' },
    tante: { male: 'neveu', female: 'niece', default: 'neveu' },
    cousin: { male: 'cousin', female: 'cousine', default: 'cousin' },
    cousine: { male: 'cousin', female: 'cousine', default: 'cousine' },
    grand_pere: { male: 'petit_fils', female: 'petite_fille', default: 'petit_fils' },
    grand_mere: { male: 'petit_fils', female: 'petite_fille', default: 'petit_fils' },
    petit_fils: { male: 'grand_pere', female: 'grand_mere', default: 'grand_pere' },
    petite_fille: { male: 'grand_pere', female: 'grand_mere', default: 'grand_pere' },
    epoux: { male: 'epoux', female: 'epouse', default: 'epouse' },
    epouse: { male: 'epoux', female: 'epouse', default: 'epoux' },
  };
  const entry = map[role];
  if (!entry) return 'autre';
  return entry[targetSex ?? 'default'] ?? entry.default;
}

export function RelationshipEditor({ characterId, existingRelationship, onClose }: RelationshipEditorProps) {
  const { characters, addRelationship, updateRelationship } = useEncyclopediaStore();

  const currentChar = characters.find((c) => c.id === characterId);
  const otherCharacters = characters.filter((c) => c.id !== characterId);

  const isEditing = !!existingRelationship;

  const [targetId, setTargetId] = useState(existingRelationship?.targetCharacterId ?? '');
  const [type, setType] = useState<RelationshipType>(existingRelationship?.type ?? 'friend');
  const [customType, setCustomType] = useState(existingRelationship?.customType ?? '');
  const [description, setDescription] = useState(existingRelationship?.description ?? '');
  const [bidirectional, setBidirectional] = useState(true);

  // Family roles
  const [familyRoleSource, setFamilyRoleSource] = useState(existingRelationship?.familyRoleSource ?? 'pere');
  const [familyRoleTarget, setFamilyRoleTarget] = useState(existingRelationship?.familyRoleTarget ?? 'fils');

  const isAlwaysReciprocal = ALWAYS_RECIPROCAL_TYPES.includes(type);
  // For non-always-reciprocal types (lover, mentor, rival, custom), show the checkbox
  const showBidirectionalCheckbox = !isAlwaysReciprocal && targetId;

  const targetChar = targetId ? characters.find((c) => c.id === targetId) : null;

  // Auto-compute reverse family role when source role changes
  useEffect(() => {
    if (type === 'family' && !isEditing) {
      const sourceSex = currentChar?.sex;
      setFamilyRoleTarget(getReverseFamilyRole(familyRoleSource, sourceSex));
    }
  }, [familyRoleSource, type, currentChar?.sex, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;

    const relData = {
      targetCharacterId: targetId,
      type,
      customType: type === 'custom' ? customType : undefined,
      familyRoleSource: type === 'family' ? familyRoleSource : undefined,
      familyRoleTarget: type === 'family' ? familyRoleTarget : undefined,
      description,
    };

    if (isEditing && existingRelationship) {
      // Update existing
      updateRelationship(characterId, existingRelationship.id, relData);

      // If always reciprocal, also update the reverse
      if (isAlwaysReciprocal) {
        const reverseRel = targetChar?.relationships.find(
          (r) => r.targetCharacterId === characterId && r.type === type
        );
        if (reverseRel) {
          updateRelationship(targetId, reverseRel.id, {
            targetCharacterId: characterId,
            type,
            customType: type === 'custom' ? customType : undefined,
            familyRoleSource: type === 'family' ? familyRoleTarget : undefined,
            familyRoleTarget: type === 'family' ? familyRoleSource : undefined,
            description,
          });
        }
      }
    } else {
      // Add new relationship
      addRelationship(characterId, relData);

      // Auto-add reverse for always-reciprocal types
      if (isAlwaysReciprocal) {
        const reverseExists = targetChar?.relationships.some(
          (r) => r.targetCharacterId === characterId && r.type === type
        );
        if (!reverseExists) {
          addRelationship(targetId, {
            targetCharacterId: characterId,
            type,
            customType: type === 'custom' ? customType : undefined,
            familyRoleSource: type === 'family' ? familyRoleTarget : undefined,
            familyRoleTarget: type === 'family' ? familyRoleSource : undefined,
            description,
          });
        }
      } else if (bidirectional) {
        // Optional bidirectional for lover, mentor, rival, custom
        const reverseExists = targetChar?.relationships.some(
          (r) => r.targetCharacterId === characterId && r.type === type
        );
        if (!reverseExists) {
          addRelationship(targetId, {
            targetCharacterId: characterId,
            type,
            customType: type === 'custom' ? customType : undefined,
            description,
          });
        }
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">
            {isEditing ? 'Modifier la relation' : 'Ajouter une relation'}
          </h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Personnage</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="input-field"
              required
              disabled={isEditing}
            >
              <option value="">Choisir un personnage...</option>
              {otherCharacters.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.surname}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">Type de relation</label>
            <select value={type} onChange={(e) => setType(e.target.value as RelationshipType)} className="input-field">
              {Object.entries(RELATIONSHIP_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {type === 'custom' && (
            <div>
              <label className="label-field">Type personnalise</label>
              <input value={customType} onChange={(e) => setCustomType(e.target.value)} className="input-field" />
            </div>
          )}

          {/* Family role selectors */}
          {type === 'family' && targetId && (
            <div className="p-3 bg-parchment-100 rounded-lg space-y-3">
              <p className="text-xs font-medium text-ink-400">Roles familiaux</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-300 mb-1 block">
                    {currentChar?.name ?? 'A'} est...
                  </label>
                  <select
                    value={familyRoleSource}
                    onChange={(e) => setFamilyRoleSource(e.target.value)}
                    className="input-field text-sm"
                  >
                    {Object.entries(FAMILY_ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-300 mb-1 block">
                    {targetChar?.name ?? 'B'} est...
                  </label>
                  <select
                    value={familyRoleTarget}
                    onChange={(e) => setFamilyRoleTarget(e.target.value)}
                    className="input-field text-sm"
                  >
                    {Object.entries(FAMILY_ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Info for always-reciprocal */}
          {isAlwaysReciprocal && targetId && !isEditing && (
            <div className="p-3 bg-parchment-100 rounded-lg">
              <p className="text-xs text-ink-300">
                Cette relation sera automatiquement ajoutee sur les deux personnages.
              </p>
            </div>
          )}

          {/* Bidirectional toggle for non-always-reciprocal types */}
          {showBidirectionalCheckbox && !isEditing && (
            <label className="flex items-start gap-3 p-3 bg-parchment-100 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
                className="mt-0.5 rounded border-parchment-400 text-bordeaux-500 focus:ring-bordeaux-500"
              />
              <div className="text-sm">
                <p className="font-medium text-ink-400">Relation reciproque</p>
                <p className="text-ink-300 text-xs mt-0.5">
                  {bidirectional
                    ? `${currentChar?.name} et ${targetChar?.name ?? '...'} sont lies mutuellement`
                    : `Seulement ${currentChar?.name} → ${targetChar?.name ?? '...'} (fleche sur le graphe)`}
                </p>
              </div>
            </label>
          )}

          <div>
            <label className="label-field">Description de la relation</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea-field" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{isEditing ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
