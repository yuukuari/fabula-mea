import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, Focus, Plus, Trash2, UserPlus, Users, ChevronUp, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { Character, GenealogyParentRole, GenealogySpouseRole, GenealogyChildRole, CharacterSex, PartialDate } from '@/types';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import {
  GENEALOGY_PARENT_ROLE_LABELS,
  GENEALOGY_SPOUSE_ROLE_LABELS,
  GENEALOGY_CHILD_ROLE_LABELS,
} from '@/lib/utils';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

interface GenealogyEditModalProps {
  characterId: string;
  centerId: string;
  onClose: () => void;
  onRecenter: (characterId: string) => void;
}

type AddLinkType = 'parent' | 'spouse' | 'child';

export function GenealogyEditModal({ characterId, centerId, onClose, onRecenter }: GenealogyEditModalProps) {
  const navigate = useNavigate();
  const {
    characters,
    updateCharacter,
    addCharacter,
    addGenealogyParent,
    removeGenealogyParent,
    addGenealogySpouse,
    removeGenealogySpouse,
    updateGenealogySpouse,
    addGenealogyChild,
    removeGenealogyChild,
    reorderGenealogySpouses,
  } = useEncyclopediaStore();

  const character = characters.find((c) => c.id === characterId);
  const [addingType, setAddingType] = useState<AddLinkType | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  if (!character) return null;

  const genealogy = character.genealogy ?? { parents: [], spouses: [], children: [] };

  // Group children by spouse
  const childrenBySpouse = useMemo(() => {
    const groups = new Map<string | undefined, typeof genealogy.children>();
    for (const ch of genealogy.children) {
      const spouseLink = ch.spouseId ? genealogy.spouses.find((s) => s.id === ch.spouseId) : undefined;
      const key = spouseLink?.characterId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ch);
    }
    return groups;
  }, [genealogy]);

  const handleToggleHideFromGraph = () => {
    updateCharacter(characterId, { hideFromRelationshipGraph: !character.hideFromRelationshipGraph });
  };

  const handleChangeName = (name: string) => {
    updateCharacter(characterId, { name });
  };

  const handleChangeSurname = (surname: string) => {
    updateCharacter(characterId, { surname });
  };

  const handleChangeNickname = (nickname: string) => {
    updateCharacter(characterId, { nickname: nickname || undefined });
  };

  const handleChangeSex = (sex: CharacterSex | '') => {
    updateCharacter(characterId, { sex: sex || undefined });
  };

  const handleChangeDescription = (description: string) => {
    updateCharacter(characterId, { description });
  };

  const handleChangeBirthDate = (field: keyof PartialDate, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10);
    const current = character.birthDate ?? {};
    const updated = { ...current, [field]: Number.isNaN(num) ? undefined : num };
    const isEmpty = updated.day == null && updated.month == null && updated.year == null;
    updateCharacter(characterId, { birthDate: isEmpty ? undefined : updated });
  };

  const handleChangeDeathDate = (field: keyof PartialDate, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10);
    const current = character.deathDate ?? {};
    const updated = { ...current, [field]: Number.isNaN(num) ? undefined : num };
    const isEmpty = updated.day == null && updated.month == null && updated.year == null;
    updateCharacter(characterId, { deathDate: isEmpty ? undefined : updated });
  };

  const handleMoveSpouse = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= genealogy.spouses.length) return;
    const ids = genealogy.spouses.map((s) => s.id);
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderGenealogySpouses(characterId, ids);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-parchment-300 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <CharacterAvatar
              imageUrl={character.imageUrl}
              imageOffsetY={character.imageOffsetY}
              name={character.name}
              size={10}
            />
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-ink-500 truncate">
                {character.name}{character.surname ? ` ${character.surname}` : ''}
              </h3>
              {character.nickname && (
                <p className="text-xs text-ink-300 italic truncate">{character.nickname}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => navigate(`/characters/${characterId}`)}
              className="btn-ghost p-1.5"
              title="Voir la fiche"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            {characterId !== centerId && (
              <button
                onClick={() => onRecenter(characterId)}
                className="btn-ghost p-1.5"
                title="Centrer le graphe"
              >
                <Focus className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1.5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible character info */}
        <div className="border-b border-parchment-300">
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-parchment-100 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 text-ink-300 transition-transform ${infoOpen ? 'rotate-90' : ''}`} />
            <Pencil className="w-3.5 h-3.5 text-ink-300" />
            <span className="text-sm font-medium text-ink-400">Fiche personnage</span>
            {!infoOpen && (character.description || character.sex) && (
              <span className="text-xs text-ink-300 truncate ml-1">
                — {character.sex === 'male' ? 'Homme' : character.sex === 'female' ? 'Femme' : ''}{character.sex && character.description ? ', ' : ''}{character.description?.slice(0, 40)}{(character.description?.length ?? 0) > 40 ? '…' : ''}
              </span>
            )}
          </button>
          {infoOpen && (
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Prénom</label>
                  <input
                    value={character.name}
                    onChange={(e) => handleChangeName(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Nom de famille</label>
                  <input
                    value={character.surname ?? ''}
                    onChange={(e) => handleChangeSurname(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Surnom</label>
                  <input
                    value={character.nickname ?? ''}
                    onChange={(e) => handleChangeNickname(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Sexe</label>
                  <select
                    value={character.sex ?? ''}
                    onChange={(e) => handleChangeSex(e.target.value as CharacterSex | '')}
                    className="input-field"
                  >
                    <option value="">Non précisé</option>
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-field">Description</label>
                <textarea
                  value={character.description}
                  onChange={(e) => handleChangeDescription(e.target.value)}
                  className="textarea-field"
                  rows={2}
                  placeholder="Quelques mots sur ce personnage…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Naissance</label>
                  <PartialDateInput
                    value={character.birthDate}
                    onChange={(field, val) => handleChangeBirthDate(field, val)}
                  />
                </div>
                <div>
                  <label className="label-field">Décès</label>
                  <PartialDateInput
                    value={character.deathDate}
                    onChange={(field, val) => handleChangeDeathDate(field, val)}
                  />
                </div>
              </div>

              <label className="flex items-center gap-1.5 text-[11px] text-ink-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={character.hideFromRelationshipGraph ?? false}
                  onChange={handleToggleHideFromGraph}
                  className="rounded border-parchment-300"
                />
                Masquer du graphe de relations
              </label>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Parents */}
          <Section
            title="Parents"
            icon={<Users className="w-4 h-4" />}
            onAdd={() => setAddingType('parent')}
          >
            {genealogy.parents.length === 0 && (
              <p className="text-xs text-ink-300 italic">Aucun parent</p>
            )}
            {genealogy.parents.map((p) => {
              const parentChar = characters.find((c) => c.id === p.characterId);
              return (
                <LinkRow
                  key={p.id}
                  character={parentChar}
                  label={p.role === 'autre' ? (p.customRole ?? 'Autre') : GENEALOGY_PARENT_ROLE_LABELS[p.role]}
                  onRemove={() => removeGenealogyParent(characterId, p.id)}
                />
              );
            })}
          </Section>

          {/* Spouses */}
          <Section
            title="Conjoints"
            icon={<Users className="w-4 h-4" />}
            onAdd={() => setAddingType('spouse')}
          >
            {genealogy.spouses.length === 0 && (
              <p className="text-xs text-ink-300 italic">Aucun conjoint</p>
            )}
            {genealogy.spouses.map((s, idx) => {
              const spouseChar = characters.find((c) => c.id === s.characterId);
              return (
                <div key={s.id} className="flex items-center gap-1">
                  {/* Reorder arrows */}
                  {genealogy.spouses.length > 1 && (
                    <div className="flex flex-col -mr-0.5">
                      <button
                        onClick={() => handleMoveSpouse(idx, -1)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-parchment-100 disabled:opacity-20"
                      >
                        <ChevronUp className="w-3 h-3 text-ink-400" />
                      </button>
                      <button
                        onClick={() => handleMoveSpouse(idx, 1)}
                        disabled={idx === genealogy.spouses.length - 1}
                        className="p-0.5 rounded hover:bg-parchment-100 disabled:opacity-20"
                      >
                        <ChevronDown className="w-3 h-3 text-ink-400" />
                      </button>
                    </div>
                  )}
                  <LinkRow
                    character={spouseChar}
                    label={s.role === 'autre' ? (s.customRole ?? 'Autre') : GENEALOGY_SPOUSE_ROLE_LABELS[s.role]}
                    onRemove={() => removeGenealogySpouse(characterId, s.id)}
                    className="flex-1"
                  />
                  <button
                    onClick={() => updateGenealogySpouse(characterId, s.id, { current: !s.current })}
                    className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      s.current
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-parchment-50 text-ink-300 border-parchment-200'
                    }`}
                  >
                    {s.current ? 'Ensemble' : 'Séparés'}
                  </button>
                </div>
              );
            })}
          </Section>

          {/* Children */}
          <Section
            title="Enfants"
            icon={<Users className="w-4 h-4" />}
            onAdd={() => setAddingType('child')}
          >
            {genealogy.children.length === 0 && (
              <p className="text-xs text-ink-300 italic">Aucun enfant</p>
            )}
            {[...childrenBySpouse.entries()].map(([spouseCharId, children]) => {
              const spouseChar = spouseCharId ? characters.find((c) => c.id === spouseCharId) : null;
              return (
                <div key={spouseCharId ?? 'none'} className="space-y-1">
                  {spouseCharId && spouseChar && (
                    <p className="text-xs text-ink-400 font-medium mt-1">
                      Avec {spouseChar.name} {spouseChar.surname ?? ''}
                    </p>
                  )}
                  {!spouseCharId && genealogy.spouses.length > 0 && children.length > 0 && (
                    <p className="text-xs text-ink-400 font-medium mt-1">Sans conjoint associé</p>
                  )}
                  {children.map((ch) => {
                    const childChar = characters.find((c) => c.id === ch.characterId);
                    return (
                      <LinkRow
                        key={ch.id}
                        character={childChar}
                        label={ch.role === 'autre' ? (ch.customRole ?? 'Autre') : GENEALOGY_CHILD_ROLE_LABELS[ch.role]}
                        onRemove={() => removeGenealogyChild(characterId, ch.id)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </Section>
        </div>

        {/* Add link modal */}
        {addingType && (
          <AddLinkDialog
            type={addingType}
            characterId={characterId}
            characters={characters}
            genealogy={genealogy}
            onClose={() => setAddingType(null)}
            addCharacter={addCharacter}
            addGenealogyParent={addGenealogyParent}
            addGenealogySpouse={addGenealogySpouse}
            addGenealogyChild={addGenealogyChild}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PartialDateInput({ value, onChange }: {
  value?: PartialDate;
  onChange: (field: keyof PartialDate, value: string) => void;
}) {
  return (
    <div className="flex gap-1 mt-0.5">
      <input
        type="number"
        value={value?.day ?? ''}
        onChange={(e) => onChange('day', e.target.value)}
        placeholder="Jour"
        min={1}
        max={31}
        className="w-full bg-parchment-50 border border-parchment-200 rounded px-1.5 py-0.5 text-xs text-ink-500 text-center"
      />
      <input
        type="number"
        value={value?.month ?? ''}
        onChange={(e) => onChange('month', e.target.value)}
        placeholder="Mois"
        min={1}
        max={12}
        className="w-full bg-parchment-50 border border-parchment-200 rounded px-1.5 py-0.5 text-xs text-ink-500 text-center"
      />
      <input
        type="number"
        value={value?.year ?? ''}
        onChange={(e) => onChange('year', e.target.value)}
        placeholder="Année"
        className="w-full bg-parchment-50 border border-parchment-200 rounded px-1.5 py-0.5 text-xs text-ink-500 text-center"
      />
    </div>
  );
}

function Section({ title, icon, onAdd, children }: {
  title: string;
  icon: React.ReactNode;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="flex items-center gap-1.5 text-sm font-display text-ink-500">
          {icon} {title}
        </h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-bordeaux-500 hover:text-bordeaux-600"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function LinkRow({ character, label, onRemove, className }: {
  character?: Character;
  label: string;
  onRemove: () => void;
  className?: string;
}) {
  if (!character) return null;
  return (
    <div className={`flex items-center gap-2 bg-parchment-50 rounded-lg px-2 py-1.5 group ${className ?? ''}`}>
      <CharacterAvatar
        imageUrl={character.imageUrl}
        imageOffsetY={character.imageOffsetY}
        name={character.name}
        size={8}
      />
      <span className="text-sm text-ink-500 flex-1 truncate">
        {character.name} {character.surname ?? ''}
      </span>
      <span className="text-xs text-ink-300">{label}</span>
      <button
        onClick={onRemove}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-opacity"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
      </button>
    </div>
  );
}

// ─── AddLinkDialog (2 tabs: existing / new) ─────────────────────────────────

function AddLinkDialog({ type, characterId, characters, genealogy, onClose, addCharacter, addGenealogyParent, addGenealogySpouse, addGenealogyChild }: {
  type: AddLinkType;
  characterId: string;
  characters: Character[];
  genealogy: NonNullable<Character['genealogy']>;
  onClose: () => void;
  addCharacter: (data: Partial<Character> & { name: string }) => string;
  addGenealogyParent: (...args: Parameters<ReturnType<typeof useEncyclopediaStore>['addGenealogyParent']>) => void;
  addGenealogySpouse: (...args: Parameters<ReturnType<typeof useEncyclopediaStore>['addGenealogySpouse']>) => void;
  addGenealogyChild: (...args: Parameters<ReturnType<typeof useEncyclopediaStore>['addGenealogyChild']>) => void;
}) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSurname, setNewSurname] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newSex, setNewSex] = useState<CharacterSex | ''>('');
  const [newDescription, setNewDescription] = useState('');
  const [newBirthDate, setNewBirthDate] = useState<PartialDate>({});
  const [newDeathDate, setNewDeathDate] = useState<PartialDate>({});

  // Role state
  const [parentRole, setParentRole] = useState<GenealogyParentRole>('pere');
  const [spouseRole, setSpouseRole] = useState<GenealogySpouseRole>('mari');
  const [childRole, setChildRole] = useState<GenealogyChildRole>('fils');
  const [current, setCurrent] = useState(true);
  const [customRole, setCustomRole] = useState('');
  const [spouseId, setSpouseId] = useState<string>('');

  const title = type === 'parent' ? 'Ajouter un parent' : type === 'spouse' ? 'Ajouter un conjoint' : 'Ajouter un enfant';

  // Exclude self + all characters already linked in any genealogy role
  const excludeIds = useMemo(() => {
    const ids = new Set([characterId]);
    genealogy.parents.forEach((p) => ids.add(p.characterId));
    genealogy.spouses.forEach((s) => ids.add(s.characterId));
    genealogy.children.forEach((ch) => ids.add(ch.characterId));
    return ids;
  }, [characterId, genealogy]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return characters
      .filter((c) => !excludeIds.has(c.id))
      .filter((c) => {
        if (!q) return true;
        return (c.name + ' ' + (c.surname ?? '')).toLowerCase().includes(q);
      })
      .slice(0, 20);
  }, [characters, excludeIds, search]);

  const role = type === 'parent' ? parentRole : type === 'spouse' ? spouseRole : childRole;
  const isCustom = role === 'autre';

  const handleSubmit = () => {
    let targetId: string;

    if (tab === 'new') {
      if (!newName.trim()) return;
      const hasBirth = newBirthDate.day != null || newBirthDate.month != null || newBirthDate.year != null;
      const hasDeath = newDeathDate.day != null || newDeathDate.month != null || newDeathDate.year != null;
      targetId = addCharacter({
        name: newName.trim(),
        surname: newSurname.trim() || undefined,
        nickname: newNickname.trim() || undefined,
        sex: newSex || undefined,
        description: newDescription.trim(),
        birthDate: hasBirth ? newBirthDate : undefined,
        deathDate: hasDeath ? newDeathDate : undefined,
        hideFromRelationshipGraph: true,
      });
    } else {
      if (!selectedId) return;
      targetId = selectedId;
    }

    if (type === 'parent') {
      addGenealogyParent(characterId, targetId, parentRole, isCustom ? customRole : undefined);
    } else if (type === 'spouse') {
      addGenealogySpouse(characterId, targetId, spouseRole, isCustom ? customRole : undefined, current);
    } else {
      addGenealogyChild(characterId, targetId, childRole, isCustom ? customRole : undefined, spouseId || undefined);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-parchment-50 rounded-xl shadow-xl w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-parchment-300">
          <h3 className="font-display text-lg font-bold text-ink-500">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-parchment-300">
          <button
            onClick={() => setTab('existing')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
              tab === 'existing' ? 'border-bordeaux-400 text-bordeaux-500' : 'border-transparent text-ink-300 hover:text-ink-400'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1.5" />
            Personnage existant
          </button>
          <button
            onClick={() => setTab('new')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
              tab === 'new' ? 'border-bordeaux-400 text-bordeaux-500' : 'border-transparent text-ink-300 hover:text-ink-400'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-1.5" />
            Nouveau personnage
          </button>
        </div>

        <div className="p-6 space-y-4">
          {tab === 'existing' ? (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un personnage…"
                className="input-field"
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filtered.length === 0 && (
                  <p className="text-xs text-ink-300 py-2 text-center">Aucun personnage trouvé</p>
                )}
                {filtered.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${
                      selectedId === c.id ? 'bg-bordeaux-50 ring-1 ring-bordeaux-200' : 'hover:bg-parchment-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="link-target"
                      value={c.id}
                      checked={selectedId === c.id}
                      onChange={() => setSelectedId(c.id)}
                      className="sr-only"
                    />
                    <CharacterAvatar imageUrl={c.imageUrl} imageOffsetY={c.imageOffsetY} name={c.name} size={8} />
                    <span className="text-sm text-ink-500 truncate">{c.name} {c.surname ?? ''}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Prénom *</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input-field"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label-field">Nom de famille</label>
                  <input
                    value={newSurname}
                    onChange={(e) => setNewSurname(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Surnom</label>
                  <input
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Sexe</label>
                  <select
                    value={newSex}
                    onChange={(e) => setNewSex(e.target.value as CharacterSex | '')}
                    className="input-field"
                  >
                    <option value="">Non précisé</option>
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-field">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="textarea-field"
                  rows={2}
                  placeholder="Quelques mots sur ce personnage…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Naissance</label>
                  <PartialDateInput
                    value={newBirthDate}
                    onChange={(field, val) => {
                      const num = val === '' ? undefined : parseInt(val, 10);
                      setNewBirthDate((prev) => ({ ...prev, [field]: Number.isNaN(num) ? undefined : num }));
                    }}
                  />
                </div>
                <div>
                  <label className="label-field">Décès</label>
                  <PartialDateInput
                    value={newDeathDate}
                    onChange={(field, val) => {
                      const num = val === '' ? undefined : parseInt(val, 10);
                      setNewDeathDate((prev) => ({ ...prev, [field]: Number.isNaN(num) ? undefined : num }));
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Role selector */}
          <div className="pt-3 border-t border-parchment-200 space-y-3">
            <div>
              <label className="label-field">Rôle</label>
              {type === 'parent' && (
                <select
                  value={parentRole}
                  onChange={(e) => setParentRole(e.target.value as GenealogyParentRole)}
                  className="input-field"
                >
                  {Object.entries(GENEALOGY_PARENT_ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
              {type === 'spouse' && (
                <select
                  value={spouseRole}
                  onChange={(e) => setSpouseRole(e.target.value as GenealogySpouseRole)}
                  className="input-field"
                >
                  {Object.entries(GENEALOGY_SPOUSE_ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
              {type === 'child' && (
                <select
                  value={childRole}
                  onChange={(e) => setChildRole(e.target.value as GenealogyChildRole)}
                  className="input-field"
                >
                  {Object.entries(GENEALOGY_CHILD_ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
            </div>
            {isCustom && (
              <div>
                <label className="label-field">Rôle personnalisé</label>
                <input
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Précisez le rôle…"
                  className="input-field"
                />
              </div>
            )}
            {type === 'spouse' && (
              <label className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={current}
                  onChange={(e) => setCurrent(e.target.checked)}
                  className="rounded border-parchment-300 accent-bordeaux-500"
                />
                Encore ensemble
              </label>
            )}
            {type === 'child' && genealogy.spouses.length > 0 && (
              <div>
                <label className="label-field">Autre parent (conjoint)</label>
                <select
                  value={spouseId}
                  onChange={(e) => setSpouseId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Aucun</option>
                  {genealogy.spouses.map((s) => {
                    const sc = characters.find((c) => c.id === s.characterId);
                    return (
                      <option key={s.id} value={s.id}>
                        {sc ? `${sc.name} ${sc.surname ?? ''}` : 'Inconnu'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-parchment-300">
          <button onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={tab === 'existing' ? !selectedId : !newName.trim()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
