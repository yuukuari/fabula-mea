/**
 * Genealogy tree layout algorithm.
 *
 * Given a center character and the full characters list, computes
 * positions for a hierarchical family tree display.
 *
 * Rules for what to show (from center character):
 * - Parents + parents' spouses + parents' other children (siblings)
 * - Grandparents (parents' parents)
 * - Spouses of center
 * - Children grouped by spouse, recursively down
 * - NOT: in-laws (parents of spouses), uncles/aunts, cousins
 */
import type { Character, CharacterGenealogy, PartialDate } from '@/types';

// ─── Layout constants ───────────────────────────────────────────────────────

const NODE_SIZE = 64;
const NODE_GAP = 32;          // horizontal gap between siblings
const COUPLE_GAP = 24;        // horizontal gap between spouses
const GENERATION_HEIGHT = 160; // vertical space between generations

// ─── Result types ───────────────────────────────────────────────────────────

export interface GenealogyNodeLayout {
  characterId: string;
  x: number;
  y: number;
  generation: number;
  isCenter: boolean;
}

export interface GenealogyCoupleEdge {
  char1Id: string;
  char2Id: string;
  current: boolean;
  y: number;
}

export interface GenealogyParentChildEdge {
  parentId: string;
  secondParentId?: string; // spouse for couple → child lines
  childId: string;
}

export interface GenealogyBadges {
  hiddenParents: number;
  hiddenSpouses: number;
  hiddenChildren: number;
}

export interface GenealogyLayoutResult {
  nodes: GenealogyNodeLayout[];
  coupleEdges: GenealogyCoupleEdge[];
  parentChildEdges: GenealogyParentChildEdge[];
  badges: Map<string, GenealogyBadges>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function getGen(c: Character): CharacterGenealogy {
  return c.genealogy ?? { parents: [], spouses: [], children: [] };
}

/** Extract the year from a PartialDate. */
function extractYear(date?: PartialDate): number | undefined {
  return date?.year;
}

/** Sort child IDs by birthDate year (earliest first). Unknowns go last. */
function sortChildIdsByBirth(childIds: string[], charMap: Map<string, Character>): string[] {
  return [...childIds].sort((a, b) => {
    const ya = extractYear(charMap.get(a)?.birthDate);
    const yb = extractYear(charMap.get(b)?.birthDate);
    if (ya == null && yb == null) return 0;
    if (ya == null) return 1;
    if (yb == null) return -1;
    return ya - yb;
  });
}

// ─── Tree collection ────────────────────────────────────────────────────────

interface FamilyUnit {
  id: string;               // the main character
  spouseIds: string[];       // displayed spouses
  childGroups: { spouseId?: string; childIds: string[] }[];
  generation: number;
}

/**
 * Collect all characters to display, starting from center.
 * Fixed: now expands ALL parents fully (their spouses, children, grandparents).
 */
function collectTree(
  centerId: string,
  charMap: Map<string, Character>,
): { displayed: Set<string>; units: FamilyUnit[]; generations: Map<string, number> } {
  const displayed = new Set<string>();
  const generations = new Map<string, number>();
  const units: FamilyUnit[] = [];

  function addChar(id: string, gen: number) {
    if (!charMap.has(id)) return;
    displayed.add(id);
    if (!generations.has(id)) generations.set(id, gen);
  }

  // ─── Collect downward (children, recursively) ───

  function collectDown(charId: string, gen: number) {
    const char = charMap.get(charId);
    if (!char) return;
    const g = getGen(char);

    // Spouses at same generation
    const spouseIds: string[] = [];
    for (const sp of g.spouses) {
      if (charMap.has(sp.characterId) && !generations.has(sp.characterId)) {
        addChar(sp.characterId, gen);
        spouseIds.push(sp.characterId);
      }
    }

    // Children grouped by spouse
    const childGroups: { spouseId?: string; childIds: string[] }[] = [];
    const childrenBySpouse = new Map<string | undefined, string[]>();
    const spouseCharIds = new Set(g.spouses.map((s) => s.characterId));

    for (const ch of g.children) {
      if (!charMap.has(ch.characterId)) continue;
      let spouseCharId: string | undefined;
      if (ch.spouseId) {
        const spouseLink = g.spouses.find((s) => s.id === ch.spouseId);
        if (spouseLink) spouseCharId = spouseLink.characterId;
      }
      // Fallback: infer spouse from child's own parents list
      if (!spouseCharId) {
        const childChar = charMap.get(ch.characterId);
        if (childChar) {
          const childParents = getGen(childChar).parents.map((p) => p.characterId);
          for (const pid of childParents) {
            if (pid !== charId && spouseCharIds.has(pid)) { spouseCharId = pid; break; }
          }
        }
      }
      const key = spouseCharId;
      if (!childrenBySpouse.has(key)) childrenBySpouse.set(key, []);
      childrenBySpouse.get(key)!.push(ch.characterId);
    }

    for (const [spouseCharId, childIds] of childrenBySpouse) {
      const validChildren = childIds.filter((id) => !generations.has(id));
      if (validChildren.length === 0) continue;
      for (const cid of validChildren) {
        addChar(cid, gen + 1);
      }
      childGroups.push({ spouseId: spouseCharId, childIds: sortChildIdsByBirth(validChildren, charMap) });
    }

    units.push({ id: charId, spouseIds, childGroups, generation: gen });

    // Recurse into children
    for (const group of childGroups) {
      for (const cid of group.childIds) {
        collectDown(cid, gen + 1);
      }
    }
  }

  // ─── Start from center ───

  addChar(centerId, 0);
  collectDown(centerId, 0);

  // ─── Collect upward: parents ───
  // KEY FIX: expand ALL parents fully, not just the first one

  const centerChar = charMap.get(centerId);
  if (centerChar) {
    const centerGenealogy = getGen(centerChar);

    // Step 1: Register ALL parents at gen -1
    const parentCharIds: string[] = [];
    for (const parentLink of centerGenealogy.parents) {
      const pid = parentLink.characterId;
      if (!charMap.has(pid)) continue;
      parentCharIds.push(pid);
      addChar(pid, -1);
    }

    // Step 2: Build family unit for EACH parent (even if already in generations)
    for (const parentId of parentCharIds) {
      // Skip if we already created a unit for this parent
      if (units.some((u) => u.id === parentId)) continue;

      const parent = charMap.get(parentId)!;
      const pg = getGen(parent);

      // Parent's spouses — include those already in generations at gen -1
      const parentSpouseIds: string[] = [];
      for (const sp of pg.spouses) {
        if (!charMap.has(sp.characterId)) continue;
        if (!generations.has(sp.characterId)) {
          // New spouse (step-parent or other)
          addChar(sp.characterId, -1);
          parentSpouseIds.push(sp.characterId);
        } else if (generations.get(sp.characterId) === -1 && sp.characterId !== parentId) {
          // Already at gen -1 (e.g., the other parent of center) — include for edges
          if (!parentSpouseIds.includes(sp.characterId)) {
            parentSpouseIds.push(sp.characterId);
          }
        }
      }

      // Parent's children (center + siblings + half-siblings)
      const parentChildGroups: { spouseId?: string; childIds: string[] }[] = [];
      const siblingsBySpouse = new Map<string | undefined, string[]>();
      const parentSpouseCharIds = new Set(pg.spouses.map((s) => s.characterId));

      for (const ch of pg.children) {
        if (!charMap.has(ch.characterId)) continue;
        // Add siblings at gen 0 (addChar is no-op for center, already at gen 0)
        addChar(ch.characterId, 0);

        let spouseCharId: string | undefined;
        if (ch.spouseId) {
          const spouseLink = pg.spouses.find((s) => s.id === ch.spouseId);
          if (spouseLink) spouseCharId = spouseLink.characterId;
        }
        // Fallback: infer spouse from child's own parents list
        if (!spouseCharId) {
          const childChar = charMap.get(ch.characterId);
          if (childChar) {
            const childParents = getGen(childChar).parents.map((p) => p.characterId);
            for (const pid of childParents) {
              if (pid !== parentId && parentSpouseCharIds.has(pid)) { spouseCharId = pid; break; }
            }
          }
        }
        if (!siblingsBySpouse.has(spouseCharId)) siblingsBySpouse.set(spouseCharId, []);
        const list = siblingsBySpouse.get(spouseCharId)!;
        if (!list.includes(ch.characterId)) list.push(ch.characterId);
      }

      for (const [spouseCharId, childIds] of siblingsBySpouse) {
        parentChildGroups.push({ spouseId: spouseCharId, childIds: sortChildIdsByBirth(childIds, charMap) });
      }

      // Ensure center is in some child group
      const centerInGroups = parentChildGroups.some((g) => g.childIds.includes(centerId));
      if (!centerInGroups) {
        parentChildGroups.push({ spouseId: undefined, childIds: [centerId] });
      }

      units.push({ id: parentId, spouseIds: parentSpouseIds, childGroups: parentChildGroups, generation: -1 });

      // ─── Grandparents (parents of this parent) ───
      // Show grandparents as standalone nodes (no spouse expansion at this level).
      // Their hidden spouses will appear as badges.
      for (const gpLink of pg.parents) {
        const gpId = gpLink.characterId;
        if (!charMap.has(gpId)) continue;
        addChar(gpId, -2);
        if (units.some((u) => u.id === gpId)) continue;

        const gp = charMap.get(gpId)!;
        const gpGenealogy = getGen(gp);

        // NO spouse expansion for grandparents — only include spouses already displayed
        const gpSpouseIds: string[] = [];
        for (const sp of gpGenealogy.spouses) {
          if (displayed.has(sp.characterId) && generations.get(sp.characterId) === -2 && sp.characterId !== gpId) {
            if (!gpSpouseIds.includes(sp.characterId)) gpSpouseIds.push(sp.characterId);
          }
        }

        // Grandparent's children — only include already-displayed ones
        const gpChildGroups: { spouseId?: string; childIds: string[] }[] = [];
        const gpChildrenBySpouse = new Map<string | undefined, string[]>();

        for (const ch of gpGenealogy.children) {
          if (!charMap.has(ch.characterId) || !displayed.has(ch.characterId)) continue;
          let spouseCharId: string | undefined;
          if (ch.spouseId) {
            const spouseLink = gpGenealogy.spouses.find((s) => s.id === ch.spouseId);
            if (spouseLink && displayed.has(spouseLink.characterId)) spouseCharId = spouseLink.characterId;
          }
          if (!gpChildrenBySpouse.has(spouseCharId)) gpChildrenBySpouse.set(spouseCharId, []);
          const list = gpChildrenBySpouse.get(spouseCharId)!;
          if (!list.includes(ch.characterId)) list.push(ch.characterId);
        }

        for (const [spouseCharId, childIds] of gpChildrenBySpouse) {
          gpChildGroups.push({ spouseId: spouseCharId, childIds });
        }

        // Ensure parentId is in some group
        if (!gpChildGroups.some((g) => g.childIds.includes(parentId))) {
          gpChildGroups.push({ spouseId: undefined, childIds: [parentId] });
        }

        units.push({
          id: gpId,
          spouseIds: gpSpouseIds,
          childGroups: gpChildGroups,
          generation: -2,
        });
      }
    }
  }

  return { displayed, units, generations };
}

// ─── Compute badges ─────────────────────────────────────────────────────────

function computeBadges(
  displayed: Set<string>,
  charMap: Map<string, Character>,
): Map<string, GenealogyBadges> {
  const badges = new Map<string, GenealogyBadges>();

  for (const charId of displayed) {
    const char = charMap.get(charId);
    if (!char) continue;
    const g = getGen(char);

    const hiddenParents = g.parents.filter((p) => !displayed.has(p.characterId)).length;
    const hiddenSpouses = g.spouses.filter((s) => !displayed.has(s.characterId)).length;
    const hiddenChildren = g.children.filter((ch) => !displayed.has(ch.characterId)).length;

    if (hiddenParents > 0 || hiddenSpouses > 0 || hiddenChildren > 0) {
      badges.set(charId, { hiddenParents, hiddenSpouses, hiddenChildren });
    }
  }

  return badges;
}

// ─── Position computation (compact grid + iterative centering) ──────────────

function computePositions(
  displayed: Set<string>,
  generations: Map<string, number>,
  units: FamilyUnit[],
  centerId: string,
  charMap: Map<string, Character>,
): GenealogyNodeLayout[] {
  const unitMap = new Map<string, FamilyUnit>();
  for (const u of units) unitMap.set(u.id, u);

  // ── Build couple lookup ──
  const coupleSet = new Set<string>();
  for (const u of units) {
    for (const spId of u.spouseIds) {
      coupleSet.add([u.id, spId].sort().join(':'));
    }
  }
  function areCoupled(a: string, b: string): boolean {
    return coupleSet.has([a, b].sort().join(':'));
  }

  // ── Step 1: Build ordered rows by walking the tree ──

  const sortedGens = [...new Set(generations.values())].sort((a, b) => a - b);
  const orderedRows = new Map<number, string[]>();
  for (const g of sortedGens) orderedRows.set(g, []);

  const rowPlaced = new Set<string>();
  function addToRow(charId: string) {
    const gen = generations.get(charId);
    if (gen == null || rowPlaced.has(charId) || !displayed.has(charId)) return;
    rowPlaced.add(charId);
    orderedRows.get(gen)!.push(charId);
  }

  // Find root units (not children of any other unit)
  const isChildOfUnit = new Set<string>();
  for (const u of units) for (const g of u.childGroups) for (const cid of g.childIds) isChildOfUnit.add(cid);
  const roots = units.filter((u) => !isChildOfUnit.has(u.id)).sort((a, b) => a.generation - b.generation);
  if (roots.length === 0 && units.length > 0) roots.push(units[0]);

  function walkUnit(unitId: string) {
    const unit = unitMap.get(unitId);
    if (!unit) { addToRow(unitId); return; }

    // Place: first spouse left, then main, then rest right
    if (unit.spouseIds.length >= 1) addToRow(unit.spouseIds[0]);
    addToRow(unit.id);
    for (let i = 1; i < unit.spouseIds.length; i++) addToRow(unit.spouseIds[i]);

    // Walk child groups — ordered by spouse position (left to right)
    // Spouse order: spouseIds[0] is left, then main char, then spouseIds[1..n] right
    // So child groups should follow: spouse[0]'s children, then "no spouse" / main, then spouse[1], etc.
    const sortedGroups = [...unit.childGroups].sort((a, b) => {
      const aIdx = a.spouseId ? unit.spouseIds.indexOf(a.spouseId) : -1;
      const bIdx = b.spouseId ? unit.spouseIds.indexOf(b.spouseId) : -1;
      // Groups with first spouse (idx 0, placed left) come first
      // Then groups with no spouse (idx -1) in the middle
      // Then groups with other spouses (idx 1, 2...) placed right
      const aOrder = aIdx === 0 ? -1 : aIdx === -1 ? 0 : aIdx;
      const bOrder = bIdx === 0 ? -1 : bIdx === -1 ? 0 : bIdx;
      return aOrder - bOrder;
    });
    for (const group of sortedGroups) {
      for (const childId of group.childIds) {
        if (unitMap.has(childId)) walkUnit(childId);
        else addToRow(childId);
      }
    }
  }

  for (const root of roots) walkUnit(root.id);
  // Add any remaining
  for (const charId of displayed) if (!rowPlaced.has(charId)) addToRow(charId);

  // ── Step 1b: Re-sort rows by attraction index ──
  // Group nodes into blocks that must stay together:
  //   - Coupled nodes (spouses) stay together
  //   - Siblings (children of the same parent unit) stay together (preserves spouse-based ordering)
  // Then sort blocks by attraction index (average position of children in the row below).

  for (let gi = sortedGens.length - 2; gi >= 0; gi--) {
    const gen = sortedGens[gi];
    const childGen = sortedGens[gi + 1];
    const row = orderedRows.get(gen)!;
    const childRow = orderedRows.get(childGen);
    if (!childRow || row.length <= 1) continue;

    // Find parent unit for each node in this row (which unit above claims it as a child)
    const nodeParent = new Map<string, string>();
    for (const u of units) {
      if (u.generation >= gen) continue;
      for (const group of u.childGroups) {
        for (const cid of group.childIds) {
          if (generations.get(cid) === gen && !nodeParent.has(cid)) {
            nodeParent.set(cid, u.id);
          }
        }
      }
    }

    // Group into blocks: adjacent nodes that are coupled OR share the same parent unit
    const blocks: string[][] = [];
    let current: string[] = [row[0]];
    for (let i = 1; i < row.length; i++) {
      const coupled = areCoupled(row[i - 1], row[i]);
      const sameParent = nodeParent.has(row[i - 1])
        && nodeParent.get(row[i - 1]) === nodeParent.get(row[i]);
      if (coupled || sameParent) {
        current.push(row[i]);
      } else {
        blocks.push(current);
        current = [row[i]];
      }
    }
    blocks.push(current);

    if (blocks.length <= 1) continue;

    // Compute attraction index for each block
    const blockAttraction = blocks.map((block) => {
      const blockSet = new Set(block);
      const childIndices: number[] = [];
      for (const nodeId of block) {
        const unit = unitMap.get(nodeId);
        if (!unit) continue;
        for (const group of unit.childGroups) {
          for (const cid of group.childIds) {
            const idx = childRow.indexOf(cid);
            if (idx !== -1) childIndices.push(idx);
          }
        }
      }
      // Fallback: check if children in row below have a parent in this block
      if (childIndices.length === 0) {
        for (let ci = 0; ci < childRow.length; ci++) {
          const childChar = charMap.get(childRow[ci]);
          if (!childChar) continue;
          const cg = getGen(childChar);
          for (const pl of cg.parents) {
            if (blockSet.has(pl.characterId)) {
              childIndices.push(ci);
              break;
            }
          }
        }
      }

      if (childIndices.length === 0) return Infinity;
      return childIndices.reduce((sum, v) => sum + v, 0) / childIndices.length;
    });

    // Sort blocks by attraction index
    const indexed = blocks.map((b, i) => ({ block: b, attraction: blockAttraction[i] }));
    indexed.sort((a, b) => a.attraction - b.attraction);
    orderedRows.set(gen, indexed.flatMap((item) => item.block));
  }

  // ── Step 1c: Enforce parent spouse-based child ordering (top-down) ──
  // When two parents share children (e.g. Jean-Michel & Adélaïde both parent Jonathan),
  // the walk order from grandparents may produce wrong child ordering.
  // Fix: for each parent unit, re-order its children in the row to match spouse-group order.
  // Units with more child groups (more marriages) take priority.

  const unitsByChildCount = [...units].sort((a, b) => b.childGroups.length - a.childGroups.length);
  for (const unit of unitsByChildCount) {
    // Compute desired child order from this unit's spouse-grouped children
    const sortedGroups = [...unit.childGroups].sort((a, b) => {
      const aIdx = a.spouseId ? unit.spouseIds.indexOf(a.spouseId) : -1;
      const bIdx = b.spouseId ? unit.spouseIds.indexOf(b.spouseId) : -1;
      const aOrder = aIdx === 0 ? -1 : aIdx === -1 ? 0 : aIdx;
      const bOrder = bIdx === 0 ? -1 : bIdx === -1 ? 0 : bIdx;
      return aOrder - bOrder;
    });
    const desiredOrder = sortedGroups.flatMap((g) => g.childIds);
    if (desiredOrder.length < 2) continue;

    const childGen = unit.generation + 1;
    const row = orderedRows.get(childGen);
    if (!row) continue;

    // Find indices of this unit's children in the row
    const childIndices: number[] = [];
    const childSet = new Set(desiredOrder);
    for (let i = 0; i < row.length; i++) {
      if (childSet.has(row[i])) childIndices.push(i);
    }
    if (childIndices.length < 2) continue;

    // Re-order: put desiredOrder children into the slots they currently occupy (preserving slot positions)
    // But also keep coupled spouses adjacent: if a child has a spouse unit expanding it,
    // we need to move the spouse along with the child.
    // Simple approach: extract the contiguous block containing all this unit's children + their neighbors,
    // then re-sort within that block.

    // Collect contiguous segments: for each child, include coupled neighbors
    const involvedIndices = new Set<number>();
    for (const ci of childIndices) {
      involvedIndices.add(ci);
      // Include coupled neighbors (spouse placed next to child by walkUnit)
      if (ci > 0 && areCoupled(row[ci - 1], row[ci])) involvedIndices.add(ci - 1);
      if (ci < row.length - 1 && areCoupled(row[ci], row[ci + 1])) involvedIndices.add(ci + 1);
    }

    // Extract the min..max range
    const sortedIndices = [...involvedIndices].sort((a, b) => a - b);
    const minIdx = sortedIndices[0];
    const maxIdx = sortedIndices[sortedIndices.length - 1];

    // Build new sub-row for this range, ordered by desiredOrder
    const subRow = row.slice(minIdx, maxIdx + 1);
    const subRowSet = new Set(subRow);

    // Build ordered result: for each child in desiredOrder, emit [spouse-left, child, spouse-right]
    const placed = new Set<string>();
    const newSubRow: string[] = [];
    for (const childId of desiredOrder) {
      if (!subRowSet.has(childId) || placed.has(childId)) continue;
      // Check for coupled spouse before this child in subRow
      const childIdx = subRow.indexOf(childId);
      if (childIdx > 0 && areCoupled(subRow[childIdx - 1], childId) && !placed.has(subRow[childIdx - 1])) {
        newSubRow.push(subRow[childIdx - 1]);
        placed.add(subRow[childIdx - 1]);
      }
      newSubRow.push(childId);
      placed.add(childId);
      // Check for coupled spouse after
      if (childIdx < subRow.length - 1 && areCoupled(childId, subRow[childIdx + 1]) && !placed.has(subRow[childIdx + 1])) {
        newSubRow.push(subRow[childIdx + 1]);
        placed.add(subRow[childIdx + 1]);
      }
    }
    // Add any remaining nodes in the range that weren't placed
    for (const id of subRow) {
      if (!placed.has(id)) { newSubRow.push(id); placed.add(id); }
    }

    // Replace the range in the row
    row.splice(minIdx, maxIdx - minIdx + 1, ...newSubRow);
  }

  // ── Step 2: Compact initial placement ──

  const positions = new Map<string, { x: number; y: number }>();

  for (const gen of sortedGens) {
    const row = orderedRows.get(gen)!;
    const y = gen * GENERATION_HEIGHT;
    let x = 0;
    for (let i = 0; i < row.length; i++) {
      if (i > 0) {
        const gap = areCoupled(row[i - 1], row[i]) ? COUPLE_GAP : NODE_GAP;
        x += NODE_SIZE + gap;
      }
      positions.set(row[i], { x, y });
    }
  }

  // ── Step 3: Iterative centering ──

  function resolveOverlaps(gen: number) {
    const row = orderedRows.get(gen);
    if (!row) return;
    for (let i = 1; i < row.length; i++) {
      const prev = positions.get(row[i - 1]);
      const curr = positions.get(row[i]);
      if (!prev || !curr) continue;
      const gap = areCoupled(row[i - 1], row[i]) ? COUPLE_GAP : NODE_GAP;
      const minX = prev.x + NODE_SIZE + gap;
      if (curr.x < minX) {
        const shift = minX - curr.x;
        for (let j = i; j < row.length; j++) {
          const p = positions.get(row[j]);
          if (p) p.x += shift;
        }
      }
    }
  }

  const unitsBottomUp = [...units].sort((a, b) => b.generation - a.generation);
  const unitsTopDown = [...units].sort((a, b) => a.generation - b.generation);

  for (let iter = 0; iter < 4; iter++) {
    // Bottom-up: center each parent group over its children
    for (const unit of unitsBottomUp) {
      const childIds = unit.childGroups.flatMap((g) => g.childIds).filter((id) => positions.has(id));
      if (childIds.length === 0) continue;

      const childXs = childIds.map((id) => positions.get(id)!.x);
      const childCenter = (Math.min(...childXs) + Math.max(...childXs)) / 2;

      const unitIds = [unit.id, ...unit.spouseIds].filter((id) => positions.has(id));
      const unitXs = unitIds.map((id) => positions.get(id)!.x);
      const unitCenter = (Math.min(...unitXs) + Math.max(...unitXs)) / 2;

      const shift = childCenter - unitCenter;
      if (Math.abs(shift) < 1) continue;

      // Shift only the unit members
      for (const id of unitIds) {
        const p = positions.get(id);
        if (p) p.x += shift;
      }
      resolveOverlaps(unit.generation);
    }

    // Top-down: center children under their parent group
    for (const unit of unitsTopDown) {
      const childIds = unit.childGroups.flatMap((g) => g.childIds).filter((id) => positions.has(id));
      if (childIds.length === 0) continue;

      const unitIds = [unit.id, ...unit.spouseIds].filter((id) => positions.has(id));
      const unitXs = unitIds.map((id) => positions.get(id)!.x);
      const unitCenter = (Math.min(...unitXs) + Math.max(...unitXs)) / 2;

      const childXs = childIds.map((id) => positions.get(id)!.x);
      const childCenter = (Math.min(...childXs) + Math.max(...childXs)) / 2;

      const shift = unitCenter - childCenter;
      if (Math.abs(shift) < 1) continue;

      // Shift only this unit's children
      for (const id of childIds) {
        const p = positions.get(id);
        if (p) p.x += shift;
      }

      // Resolve overlaps in the children's generation
      const childGen = generations.get(childIds[0]);
      if (childGen != null) resolveOverlaps(childGen);
    }
  }

  // ── Step 4: Center on centerId ──
  const cp = positions.get(centerId);
  if (cp) {
    const ox = cp.x;
    for (const p of positions.values()) p.x -= ox;
  }

  return [...positions.entries()].map(([charId, pos]) => ({
    characterId: charId,
    x: pos.x,
    y: pos.y,
    generation: generations.get(charId) ?? 0,
    isCenter: charId === centerId,
  }));
}

// ─── Edge computation ───────────────────────────────────────────────────────

function computeEdges(
  units: FamilyUnit[],
  displayed: Set<string>,
  charMap: Map<string, Character>,
  nodePositions: Map<string, { x: number; y: number }>,
): { coupleEdges: GenealogyCoupleEdge[]; parentChildEdges: GenealogyParentChildEdge[] } {
  const coupleEdges: GenealogyCoupleEdge[] = [];
  const parentChildEdges: GenealogyParentChildEdge[] = [];
  const seenCouples = new Set<string>();
  const seenChildEdges = new Set<string>(); // dedup parent→child edges

  for (const unit of units) {
    if (!displayed.has(unit.id)) continue;
    const char = charMap.get(unit.id);
    if (!char) continue;
    const g = getGen(char);
    const pos = nodePositions.get(unit.id);
    if (!pos) continue;

    // Couple edges
    for (const spId of unit.spouseIds) {
      if (!displayed.has(spId)) continue;
      const key = [unit.id, spId].sort().join(':');
      if (seenCouples.has(key)) continue;
      seenCouples.add(key);

      const spouseLink = g.spouses.find((s) => s.characterId === spId);
      coupleEdges.push({
        char1Id: unit.id,
        char2Id: spId,
        current: spouseLink?.current ?? true,
        y: pos.y,
      });
    }

    // Parent-child edges (dedup by child to avoid duplicate lines)
    for (const group of unit.childGroups) {
      for (const childId of group.childIds) {
        if (!displayed.has(childId)) continue;
        if (seenChildEdges.has(childId)) continue;
        seenChildEdges.add(childId);

        parentChildEdges.push({
          parentId: unit.id,
          secondParentId: group.spouseId,
          childId,
        });
      }
    }
  }

  return { coupleEdges, parentChildEdges };
}

// ─── Main entry point ───────────────────────────────────────────────────────

export function computeGenealogyLayout(
  centerId: string,
  characters: Character[],
): GenealogyLayoutResult {
  const charMap = new Map<string, Character>();
  for (const c of characters) charMap.set(c.id, c);

  if (!charMap.has(centerId)) {
    return { nodes: [], coupleEdges: [], parentChildEdges: [], badges: new Map(), minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  const { displayed, units, generations } = collectTree(centerId, charMap);
  const nodes = computePositions(displayed, generations, units, centerId, charMap);
  const badges = computeBadges(displayed, charMap);

  // Build position map for edge computation
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) nodePositions.set(n.characterId, { x: n.x, y: n.y });

  const { coupleEdges, parentChildEdges } = computeEdges(units, displayed, charMap, nodePositions);

  // Compute bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x - NODE_SIZE / 2 < minX) minX = n.x - NODE_SIZE / 2;
    if (n.x + NODE_SIZE / 2 > maxX) maxX = n.x + NODE_SIZE / 2;
    if (n.y - NODE_SIZE / 2 < minY) minY = n.y - NODE_SIZE / 2;
    if (n.y + NODE_SIZE / 2 + 24 > maxY) maxY = n.y + NODE_SIZE / 2 + 24;
  }

  if (nodes.length === 0) {
    minX = maxX = minY = maxY = 0;
  }

  return { nodes, coupleEdges, parentChildEdges, badges, minX, maxX, minY, maxY };
}

/**
 * Get the set of character IDs directly connected to a given character
 * (parents, spouses, children). Used for hover highlighting.
 */
export function getConnectedIds(charId: string, characters: Character[]): Set<string> {
  const char = characters.find((c) => c.id === charId);
  const ids = new Set<string>();
  ids.add(charId);
  if (!char?.genealogy) return ids;
  for (const p of char.genealogy.parents) ids.add(p.characterId);
  for (const s of char.genealogy.spouses) ids.add(s.characterId);
  for (const c of char.genealogy.children) ids.add(c.characterId);
  return ids;
}

export { NODE_SIZE, GENERATION_HEIGHT };
