/**
 * Bidirectional CRUD helpers for character genealogy data.
 * Each mutation updates ALL sides:
 * - addChild: updates parent + spouse + child
 * - addParent: updates child + parent + auto-links parents as spouses
 * - addSpouse: updates both characters
 * All functions are pure — they take Character[] and return a new Character[].
 */
import type {
  Character, CharacterGenealogy, CharacterSex,
  GenealogyParent, GenealogySpouse, GenealogyChild,
  GenealogyParentRole, GenealogySpouseRole, GenealogyChildRole,
} from '@/types';
import { generateId, now } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMPTY_GENEALOGY: CharacterGenealogy = { parents: [], spouses: [], children: [] };

function getGenealogy(c: Character): CharacterGenealogy {
  return c.genealogy ?? { ...EMPTY_GENEALOGY };
}

function inferChildRole(sex?: CharacterSex): GenealogyChildRole {
  if (sex === 'male') return 'fils';
  if (sex === 'female') return 'fille';
  return 'autre';
}

function inferParentRole(sex?: CharacterSex): GenealogyParentRole {
  if (sex === 'male') return 'pere';
  if (sex === 'female') return 'mere';
  return 'autre';
}

function inferSpouseRole(sex?: CharacterSex): GenealogySpouseRole {
  if (sex === 'male') return 'mari';
  if (sex === 'female') return 'femme';
  return 'autre';
}

function reverseSpouseRole(role: GenealogySpouseRole, targetSex?: CharacterSex): GenealogySpouseRole {
  if (role === 'mari') return targetSex === 'male' ? 'mari' : 'femme';
  if (role === 'femme') return targetSex === 'male' ? 'mari' : 'femme';
  if (role === 'concubin') return targetSex === 'female' ? 'concubine' : 'concubin';
  if (role === 'concubine') return targetSex === 'male' ? 'concubin' : 'concubine';
  return 'autre';
}

function touch(c: Character): Character {
  return { ...c, updatedAt: now() };
}

// ─── Add Parent ─────────────────────────────────────────────────────────────
// Adding parent B to child C:
// 1. C gets B as parent
// 2. B gets C as child
// 3. If C already has parent(s) A: A and B become spouses (if not already),
//    and both A's and B's child entries for C get spouseId set to each other

export function addGenealogyParent(
  characters: Character[],
  childId: string,
  parentCharId: string,
  role: GenealogyParentRole,
  customRole?: string,
): Character[] {
  const child = characters.find((c) => c.id === childId);
  const newParent = characters.find((c) => c.id === parentCharId);
  if (!child || !newParent) return characters;

  const parentLinkId = generateId();
  const childLinkId = generateId();

  // Get existing parent character IDs (before adding the new one)
  const existingParentCharIds = getGenealogy(child).parents.map((p) => p.characterId);

  // Step 1: Add parent link on child + child link on parent
  let result = characters.map((c) => {
    if (c.id === childId) {
      const g = getGenealogy(c);
      const newParentLink: GenealogyParent = { id: parentLinkId, characterId: parentCharId, role, customRole };
      return touch({ ...c, genealogy: { ...g, parents: [...g.parents, newParentLink] } });
    }
    if (c.id === parentCharId) {
      const g = getGenealogy(c);
      const newChild: GenealogyChild = {
        id: childLinkId,
        characterId: childId,
        role: inferChildRole(child.sex),
      };
      return touch({ ...c, genealogy: { ...g, children: [...g.children, newChild] } });
    }
    return c;
  });

  // Step 2: For each existing parent, make them spouse of the new parent (if not already)
  // and cross-reference spouseId on child entries
  for (const existingParentCharId of existingParentCharIds) {
    const existingParent = result.find((c) => c.id === existingParentCharId);
    if (!existingParent) continue;

    const existingParentGen = getGenealogy(existingParent);
    const alreadySpouses = existingParentGen.spouses.some((s) => s.characterId === parentCharId);

    if (!alreadySpouses) {
      // Make them spouses
      result = addGenealogySpouse(result, existingParentCharId, parentCharId, inferSpouseRole(newParent.sex), undefined, true);
    }

    // Now cross-reference spouseId on child entries for childId
    result = result.map((c) => {
      if (c.id === existingParentCharId) {
        const g = getGenealogy(c);
        const spouseLinkToNewParent = g.spouses.find((s) => s.characterId === parentCharId);
        return {
          ...c,
          genealogy: {
            ...g,
            children: g.children.map((ch) =>
              ch.characterId === childId ? { ...ch, spouseId: spouseLinkToNewParent?.id } : ch
            ),
          },
        };
      }
      if (c.id === parentCharId) {
        const g = getGenealogy(c);
        const spouseLinkToExistingParent = g.spouses.find((s) => s.characterId === existingParentCharId);
        return {
          ...c,
          genealogy: {
            ...g,
            children: g.children.map((ch) =>
              ch.characterId === childId ? { ...ch, spouseId: spouseLinkToExistingParent?.id } : ch
            ),
          },
        };
      }
      return c;
    });
  }

  return result;
}

// ─── Remove Parent ──────────────────────────────────────────────────────────
// Removing parent from child:
// 1. Remove parent link from child
// 2. Remove child from parent
// 3. On other parents: clear spouseId reference to removed parent on their child entry

export function removeGenealogyParent(
  characters: Character[],
  childId: string,
  parentLinkId: string,
): Character[] {
  const child = characters.find((c) => c.id === childId);
  if (!child) return characters;
  const link = getGenealogy(child).parents.find((p) => p.id === parentLinkId);
  if (!link) return characters;
  const parentCharId = link.characterId;

  // Find remaining parents (other than the one being removed)
  const otherParentCharIds = getGenealogy(child).parents
    .filter((p) => p.id !== parentLinkId)
    .map((p) => p.characterId);

  return characters.map((c) => {
    if (c.id === childId) {
      const g = getGenealogy(c);
      return touch({ ...c, genealogy: { ...g, parents: g.parents.filter((p) => p.id !== parentLinkId) } });
    }
    if (c.id === parentCharId) {
      const g = getGenealogy(c);
      return touch({ ...c, genealogy: { ...g, children: g.children.filter((ch) => ch.characterId !== childId) } });
    }
    // On other parents: if their child entry for childId references the removed parent via spouseId, clear it
    if (otherParentCharIds.includes(c.id)) {
      const g = getGenealogy(c);
      // Find spouse link that points to the removed parent
      const spouseLinkToRemoved = g.spouses.find((s) => s.characterId === parentCharId);
      if (spouseLinkToRemoved) {
        const updated = g.children.some((ch) => ch.characterId === childId && ch.spouseId === spouseLinkToRemoved.id);
        if (updated) {
          return touch({
            ...c,
            genealogy: {
              ...g,
              children: g.children.map((ch) =>
                ch.characterId === childId && ch.spouseId === spouseLinkToRemoved.id
                  ? { ...ch, spouseId: undefined }
                  : ch
              ),
            },
          });
        }
      }
    }
    return c;
  });
}

// ─── Add Spouse ─────────────────────────────────────────────────────────────
// Adding spouse B to character A:
// 1. A gets B as spouse
// 2. B gets A as spouse (with reversed role)

export function addGenealogySpouse(
  characters: Character[],
  charId: string,
  spouseCharId: string,
  role: GenealogySpouseRole,
  customRole: string | undefined,
  current: boolean,
): Character[] {
  const char = characters.find((c) => c.id === charId);
  const spouse = characters.find((c) => c.id === spouseCharId);
  if (!char || !spouse) return characters;

  // Check if already spouses (prevent duplicates)
  const charGen = getGenealogy(char);
  if (charGen.spouses.some((s) => s.characterId === spouseCharId)) return characters;

  const linkId1 = generateId();
  const linkId2 = generateId();

  return characters.map((c) => {
    if (c.id === charId) {
      const g = getGenealogy(c);
      const newSpouse: GenealogySpouse = { id: linkId1, characterId: spouseCharId, role, customRole, current };
      return touch({ ...c, genealogy: { ...g, spouses: [...g.spouses, newSpouse] } });
    }
    if (c.id === spouseCharId) {
      const g = getGenealogy(c);
      const reverseRole = reverseSpouseRole(role, char.sex);
      const newSpouse: GenealogySpouse = { id: linkId2, characterId: charId, role: reverseRole, customRole, current };
      return touch({ ...c, genealogy: { ...g, spouses: [...g.spouses, newSpouse] } });
    }
    return c;
  });
}

// ─── Remove Spouse ──────────────────────────────────────────────────────────

export function removeGenealogySpouse(
  characters: Character[],
  charId: string,
  spouseLinkId: string,
): Character[] {
  const char = characters.find((c) => c.id === charId);
  if (!char) return characters;
  const link = getGenealogy(char).spouses.find((s) => s.id === spouseLinkId);
  if (!link) return characters;
  const spouseCharId = link.characterId;

  return characters.map((c) => {
    if (c.id === charId) {
      const g = getGenealogy(c);
      // Also clear spouseId references on children that pointed to this spouse link
      return touch({
        ...c,
        genealogy: {
          ...g,
          spouses: g.spouses.filter((s) => s.id !== spouseLinkId),
          children: g.children.map((ch) => ch.spouseId === spouseLinkId ? { ...ch, spouseId: undefined } : ch),
        },
      });
    }
    if (c.id === spouseCharId) {
      const g = getGenealogy(c);
      // Find the reverse spouse link and clear children spouseId references
      const reverseLink = g.spouses.find((s) => s.characterId === charId);
      const reverseLinkId = reverseLink?.id;
      return touch({
        ...c,
        genealogy: {
          ...g,
          spouses: g.spouses.filter((s) => s.characterId !== charId),
          children: reverseLinkId
            ? g.children.map((ch) => ch.spouseId === reverseLinkId ? { ...ch, spouseId: undefined } : ch)
            : g.children,
        },
      });
    }
    return c;
  });
}

// ─── Update Spouse ──────────────────────────────────────────────────────────

export function updateGenealogySpouse(
  characters: Character[],
  charId: string,
  spouseLinkId: string,
  data: Partial<Pick<GenealogySpouse, 'role' | 'customRole' | 'current'>>,
): Character[] {
  const char = characters.find((c) => c.id === charId);
  if (!char) return characters;
  const link = getGenealogy(char).spouses.find((s) => s.id === spouseLinkId);
  if (!link) return characters;
  const spouseCharId = link.characterId;

  return characters.map((c) => {
    if (c.id === charId) {
      const g = getGenealogy(c);
      return touch({
        ...c,
        genealogy: { ...g, spouses: g.spouses.map((s) => s.id === spouseLinkId ? { ...s, ...data } : s) },
      });
    }
    if (c.id === spouseCharId) {
      const g = getGenealogy(c);
      const reverseData: Partial<GenealogySpouse> = {};
      if (data.current !== undefined) reverseData.current = data.current;
      if (data.role !== undefined) {
        reverseData.role = reverseSpouseRole(data.role, char.sex);
      }
      if (data.customRole !== undefined) reverseData.customRole = data.customRole;
      return touch({
        ...c,
        genealogy: {
          ...g,
          spouses: g.spouses.map((s) => s.characterId === charId ? { ...s, ...reverseData } : s),
        },
      });
    }
    return c;
  });
}

// ─── Add Child ──────────────────────────────────────────────────────────────
// Adding child C to parent A with spouse B:
// 1. A gets C as child (spouseId pointing to B on A's spouses)
// 2. B gets C as child (spouseId pointing to A on B's spouses)
// 3. C gets A as parent AND B as parent

export function addGenealogyChild(
  characters: Character[],
  parentId: string,
  childCharId: string,
  role: GenealogyChildRole,
  customRole?: string,
  spouseLinkId?: string, // link ID on parent's spouses array
): Character[] {
  const parent = characters.find((c) => c.id === parentId);
  const child = characters.find((c) => c.id === childCharId);
  if (!parent || !child) return characters;

  // Resolve spouse character
  let spouseCharId: string | undefined;
  if (spouseLinkId) {
    const spouseLink = getGenealogy(parent).spouses.find((s) => s.id === spouseLinkId);
    if (spouseLink) spouseCharId = spouseLink.characterId;
  }
  const spouse = spouseCharId ? characters.find((c) => c.id === spouseCharId) : undefined;

  // Pre-generate IDs
  const childLinkOnParent = generateId();
  const childLinkOnSpouse = generateId();
  const parentLinkOnChild = generateId();
  const spouseParentLinkOnChild = generateId();

  return characters.map((c) => {
    // 1. Add child to parent
    if (c.id === parentId) {
      const g = getGenealogy(c);
      const newChild: GenealogyChild = { id: childLinkOnParent, characterId: childCharId, role, customRole, spouseId: spouseLinkId };
      return touch({ ...c, genealogy: { ...g, children: [...g.children, newChild] } });
    }

    // 2. Add parents to child
    if (c.id === childCharId) {
      const g = getGenealogy(c);
      const newParents = [...g.parents];
      // Add parent (if not already)
      if (!g.parents.some((p) => p.characterId === parentId)) {
        newParents.push({ id: parentLinkOnChild, characterId: parentId, role: inferParentRole(parent.sex) });
      }
      // Add spouse as parent too (if not already)
      if (spouse && spouseCharId && !g.parents.some((p) => p.characterId === spouseCharId)) {
        newParents.push({ id: spouseParentLinkOnChild, characterId: spouseCharId, role: inferParentRole(spouse.sex) });
      }
      return touch({ ...c, genealogy: { ...g, parents: newParents } });
    }

    // 3. Add child to spouse
    if (spouse && spouseCharId && c.id === spouseCharId) {
      const g = getGenealogy(c);
      // Skip if already has this child
      if (g.children.some((ch) => ch.characterId === childCharId)) return c;
      // Find spouse's link back to parent for spouseId
      const spouseLinkToParent = g.spouses.find((s) => s.characterId === parentId);
      const newChild: GenealogyChild = {
        id: childLinkOnSpouse,
        characterId: childCharId,
        role,
        customRole,
        spouseId: spouseLinkToParent?.id,
      };
      return touch({ ...c, genealogy: { ...g, children: [...g.children, newChild] } });
    }

    return c;
  });
}

// ─── Remove Child ───────────────────────────────────────────────────────────
// Removing child C from parent A:
// 1. Remove C from A's children
// 2. Remove A from C's parents
// 3. If C was linked to spouse B: remove C from B's children, remove B from C's parents

export function removeGenealogyChild(
  characters: Character[],
  parentId: string,
  childLinkId: string,
): Character[] {
  const parent = characters.find((c) => c.id === parentId);
  if (!parent) return characters;
  const link = getGenealogy(parent).children.find((ch) => ch.id === childLinkId);
  if (!link) return characters;
  const childCharId = link.characterId;

  // Resolve spouse if linked
  let spouseCharId: string | undefined;
  if (link.spouseId) {
    const spouseLink = getGenealogy(parent).spouses.find((s) => s.id === link.spouseId);
    if (spouseLink) spouseCharId = spouseLink.characterId;
  }

  return characters.map((c) => {
    // Remove child from parent
    if (c.id === parentId) {
      const g = getGenealogy(c);
      return touch({ ...c, genealogy: { ...g, children: g.children.filter((ch) => ch.id !== childLinkId) } });
    }
    // Remove parent (and spouse) from child
    if (c.id === childCharId) {
      const g = getGenealogy(c);
      let newParents = g.parents.filter((p) => p.characterId !== parentId);
      if (spouseCharId) {
        newParents = newParents.filter((p) => p.characterId !== spouseCharId);
      }
      return touch({ ...c, genealogy: { ...g, parents: newParents } });
    }
    // Remove child from spouse
    if (spouseCharId && c.id === spouseCharId) {
      const g = getGenealogy(c);
      return touch({ ...c, genealogy: { ...g, children: g.children.filter((ch) => ch.characterId !== childCharId) } });
    }
    return c;
  });
}

// ─── Reorder Spouses ───────────────────────────────────────────────────────

export function reorderGenealogySpouses(
  characters: Character[],
  charId: string,
  spouseLinkIds: string[],
): Character[] {
  return characters.map((c) => {
    if (c.id !== charId) return c;
    const g = getGenealogy(c);
    const reordered = spouseLinkIds
      .map((id) => g.spouses.find((s) => s.id === id))
      .filter((s): s is GenealogySpouse => !!s);
    // Append any spouses not in the list (safety)
    for (const s of g.spouses) {
      if (!spouseLinkIds.includes(s.id)) reordered.push(s);
    }
    return touch({ ...c, genealogy: { ...g, spouses: reordered } });
  });
}

// ─── Cleanup on character deletion ──────────────────────────────────────────

export function cleanupGenealogyOnDelete(characters: Character[], deletedCharId: string): Character[] {
  return characters.map((c) => {
    const g = c.genealogy;
    if (!g) return c;

    const hasParent = g.parents.some((p) => p.characterId === deletedCharId);
    const hasSpouse = g.spouses.some((s) => s.characterId === deletedCharId);
    const hasChild = g.children.some((ch) => ch.characterId === deletedCharId);

    if (!hasParent && !hasSpouse && !hasChild) return c;

    // Find spouse link IDs that point to deleted character, to clean up children.spouseId
    const deletedSpouseLinkIds = new Set(
      g.spouses.filter((s) => s.characterId === deletedCharId).map((s) => s.id)
    );

    return touch({
      ...c,
      genealogy: {
        parents: g.parents.filter((p) => p.characterId !== deletedCharId),
        spouses: g.spouses.filter((s) => s.characterId !== deletedCharId),
        children: g.children
          .filter((ch) => ch.characterId !== deletedCharId)
          .map((ch) => ch.spouseId && deletedSpouseLinkIds.has(ch.spouseId) ? { ...ch, spouseId: undefined } : ch),
      },
    });
  });
}
