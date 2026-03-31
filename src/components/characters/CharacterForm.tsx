import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { CharacterEvolution, CharacterSex } from '@/types';

interface CharacterFormProps {
  characterId: string | null;
  onClose: () => void;
}

export function CharacterForm({ characterId, onClose }: CharacterFormProps) {
  const characters = useBookStore((s) => s.characters);
  const addCharacter = useBookStore((s) => s.addCharacter);
  const updateCharacter = useBookStore((s) => s.updateCharacter);

  const existing = characterId ? characters.find((c) => c.id === characterId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [surname, setSurname] = useState(existing?.surname ?? '');
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [sex, setSex] = useState<CharacterSex | ''>(existing?.sex ?? '');
  const [age, setAge] = useState<string>(existing?.age !== undefined && existing?.age !== null ? String(existing.age) : '');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl);
  const [imageOffsetY, setImageOffsetY] = useState(existing?.imageOffsetY ?? 50);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [inGlossary, setInGlossary] = useState(existing?.inGlossary ?? false);
  const [personality, setPersonality] = useState(existing?.personality ?? '');
  const [qualities, setQualities] = useState(existing?.qualities?.join(', ') ?? '');
  const [flaws, setFlaws] = useState(existing?.flaws?.join(', ') ?? '');
  const [skills, setSkills] = useState(existing?.skills?.join(', ') ?? '');
  const [profession, setProfession] = useState(existing?.profession ?? '');
  const [lifeGoal, setLifeGoal] = useState(existing?.lifeGoal ?? '');
  const [likes, setLikes] = useState(existing?.likes?.join(', ') ?? '');
  const [dislikes, setDislikes] = useState(existing?.dislikes?.join(', ') ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [evolution, setEvolution] = useState<CharacterEvolution>(
    existing?.evolution ?? { beforeStory: '', duringStory: '', endOfStory: '', initiationJourney: '' }
  );
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // Track if form has been modified
  const isDirty = useCallback(() => {
    if (!existing) {
      // New character: dirty if anything has been filled
      return !!(name || surname || nickname || sex || age || imageUrl || description || inGlossary || personality || qualities || flaws || skills || profession || lifeGoal || likes || dislikes || notes || evolution.beforeStory || evolution.duringStory || evolution.endOfStory || evolution.initiationJourney);
    }
    // Existing: compare against original values
    return (
      name !== (existing.name ?? '') ||
      surname !== (existing.surname ?? '') ||
      nickname !== (existing.nickname ?? '') ||
      sex !== (existing.sex ?? '') ||
      age !== (existing.age !== undefined && existing.age !== null ? String(existing.age) : '') ||
      imageUrl !== existing.imageUrl ||
      imageOffsetY !== (existing.imageOffsetY ?? 50) ||
      description !== (existing.description ?? '') ||
      inGlossary !== (existing.inGlossary ?? false) ||
      personality !== (existing.personality ?? '') ||
      qualities !== (existing.qualities?.join(', ') ?? '') ||
      flaws !== (existing.flaws?.join(', ') ?? '') ||
      skills !== (existing.skills?.join(', ') ?? '') ||
      profession !== (existing.profession ?? '') ||
      lifeGoal !== (existing.lifeGoal ?? '') ||
      likes !== (existing.likes?.join(', ') ?? '') ||
      dislikes !== (existing.dislikes?.join(', ') ?? '') ||
      notes !== (existing.notes ?? '') ||
      evolution.beforeStory !== (existing.evolution?.beforeStory ?? '') ||
      evolution.duringStory !== (existing.evolution?.duringStory ?? '') ||
      evolution.endOfStory !== (existing.evolution?.endOfStory ?? '') ||
      evolution.initiationJourney !== (existing.evolution?.initiationJourney ?? '')
    );
  }, [name, surname, nickname, sex, age, imageUrl, imageOffsetY, description, inGlossary, personality, qualities, flaws, skills, profession, lifeGoal, likes, dislikes, notes, evolution, existing]);

  const splitList = (str: string) => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSave = () => {
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      surname: surname.trim(),
      nickname: nickname.trim(),
      sex: sex || undefined,
      age: age ? parseInt(age, 10) : undefined,
      imageUrl,
      imageOffsetY,
      description,
      inGlossary,
      personality,
      qualities: splitList(qualities),
      flaws: splitList(flaws),
      skills: splitList(skills),
      profession,
      lifeGoal,
      likes: splitList(likes),
      dislikes: splitList(dislikes),
      notes,
      evolution,
    };

    if (existing) {
      updateCharacter(existing.id, data);
    } else {
      addCharacter(data);
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
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-2xl mx-4 my-4">
        <div className="flex items-center justify-between p-6 border-b border-parchment-300">
          <h3 className="font-display text-xl font-bold text-ink-500">
            {existing ? 'Modifier le personnage' : 'Nouveau personnage'}
          </h3>
          <button type="button" onClick={handleClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            round
            offsetY={imageOffsetY}
            onOffsetYChange={setImageOffsetY}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Prénom *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="label-field">Nom</label>
              <input value={surname} onChange={(e) => setSurname(e.target.value)} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label-field">Sexe</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as CharacterSex | '')}
                className="input-field"
              >
                <option value="">Non précisé</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
              </select>
            </div>
            <div>
              <label className="label-field">Âge</label>
              <input
                type="number"
                min="0"
                max="999"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="input-field"
                placeholder="Ex: 25"
              />
            </div>
            <div>
              <label className="label-field">Surnom</label>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="label-field">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea-field" rows={3} />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer">
            <input
              type="checkbox"
              checked={inGlossary}
              onChange={(e) => setInGlossary(e.target.checked)}
              className="rounded border-parchment-300 accent-bordeaux-500"
            />
            Inclure dans le glossaire du livre
          </label>

          <div>
            <label className="label-field">Personnalité / Caractère</label>
            <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} className="textarea-field" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Qualités (séparées par des virgules)</label>
              <input value={qualities} onChange={(e) => setQualities(e.target.value)} className="input-field" placeholder="Courageux, loyal, empathique" />
            </div>
            <div>
              <label className="label-field">Défauts (séparés par des virgules)</label>
              <input value={flaws} onChange={(e) => setFlaws(e.target.value)} className="input-field" placeholder="Impulsif, orgueilleux" />
            </div>
          </div>

          <div>
            <label className="label-field">Compétences (séparées par des virgules)</label>
            <input value={skills} onChange={(e) => setSkills(e.target.value)} className="input-field" placeholder="Escrime, équitation, diplomatie" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Métier</label>
              <input value={profession} onChange={(e) => setProfession(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-field">But dans la vie</label>
              <input value={lifeGoal} onChange={(e) => setLifeGoal(e.target.value)} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Ce qu'il/elle aime</label>
              <input value={likes} onChange={(e) => setLikes(e.target.value)} className="input-field" placeholder="Musique, solitude, nuits etoilees" />
            </div>
            <div>
              <label className="label-field">Ce qu'il/elle n'aime pas</label>
              <input value={dislikes} onChange={(e) => setDislikes(e.target.value)} className="input-field" placeholder="Mensonge, foule, injustice" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-display font-semibold text-ink-400">Evolution / Arc narratif</h4>
            <div>
              <label className="label-field">Avant l'histoire</label>
              <textarea
                value={evolution.beforeStory}
                onChange={(e) => setEvolution({ ...evolution, beforeStory: e.target.value })}
                className="textarea-field" rows={2}
              />
            </div>
            <div>
              <label className="label-field">Pendant l'histoire</label>
              <textarea
                value={evolution.duringStory}
                onChange={(e) => setEvolution({ ...evolution, duringStory: e.target.value })}
                className="textarea-field" rows={2}
              />
            </div>
            <div>
              <label className="label-field">Fin de l'histoire</label>
              <textarea
                value={evolution.endOfStory}
                onChange={(e) => setEvolution({ ...evolution, endOfStory: e.target.value })}
                className="textarea-field" rows={2}
              />
            </div>
            <div>
              <label className="label-field">Chemin initiatique</label>
              <textarea
                value={evolution.initiationJourney ?? ''}
                onChange={(e) => setEvolution({ ...evolution, initiationJourney: e.target.value })}
                className="textarea-field" rows={2}
              />
            </div>
          </div>

          <div>
            <label className="label-field">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="textarea-field" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-parchment-300">
            <button type="button" onClick={handleClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">
              {existing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>

      {/* Unsaved changes confirmation */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnsavedConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Modifications non enregistrées</h3>
            <p className="text-sm text-ink-300 mb-6">Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUnsavedConfirm(false)} className="btn-secondary text-sm">
                Annuler
              </button>
              <button
                onClick={() => { setShowUnsavedConfirm(false); onClose(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-400 hover:bg-parchment-100 transition-colors"
              >
                Quitter
              </button>
              <button
                onClick={() => { setShowUnsavedConfirm(false); handleSave(); }}
                className="btn-primary text-sm"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
