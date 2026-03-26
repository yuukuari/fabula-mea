import { useState } from 'react';
import { X } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/utils';
import type { RelationshipType } from '@/types';

interface RelationshipEditorProps {
  characterId: string;
  onClose: () => void;
}

export function RelationshipEditor({ characterId, onClose }: RelationshipEditorProps) {
  const characters = useBookStore((s) => s.characters);
  const addRelationship = useBookStore((s) => s.addRelationship);

  const otherCharacters = characters.filter((c) => c.id !== characterId);

  const [targetId, setTargetId] = useState('');
  const [type, setType] = useState<RelationshipType>('friend');
  const [customType, setCustomType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    addRelationship(characterId, {
      targetCharacterId: targetId,
      type,
      customType: type === 'custom' ? customType : undefined,
      description,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">Ajouter une relation</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Personnage</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="input-field" required>
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

          <div>
            <label className="label-field">Description de la relation</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea-field" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">Ajouter</button>
          </div>
        </form>
      </div>
    </div>
  );
}
