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

    for (const ch of g.children) {
      if (!charMap.has(ch.characterId)) continue;
      let spouseCharId: string | undefined;
      if (ch.spouseId) {
        const spouseLink = g.spouses.find((s) => s.id === ch.spouseId);
        if (spouseLink) spouseCharId = spouseLink.characterId;
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

      for (const ch of pg.children) {
        if (!charMap.has(ch.characterId)) continue;
        // Add siblings at gen 0 (addChar is no-op for center, already at gen 0)
        addChar(ch.characterId, 0);

        let spouseCharId: string | undefined;
        if (ch.spouseId) {
          const spouseLink = pg.spouses.find((s) => s.id === ch.spouseId);
          if (spouseLink) spouseCharId = spouseLink.characterId;
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

// ─── Position computation (tree-based) ──────────────────────────────────────

function computePositions(
  displayed: Set<string>,
  generations: Map<string, number>,
  units: FamilyUnit[],
  centerId: string,
): GenealogyNodeLayout[] {
  const unitMap = new Map<string, FamilyUnit>();
  for (const u of units) unitMap.set(u.id, u);

  const positions = new Map<string, { x: number; y: number }>();

  // ─── Subtree width computation (memoized) ───

  const widthCache = new Map<string, number>();
  const computing = new Set<string>(); // cycle guard

  function coupleWidth(unit: FamilyUnit): number {
    return NODE_SIZE + unit.spouseIds.length * (COUPLE_GAP + NODE_SIZE);
  }

  function childGroupWidth(childIds: string[]): number {
    let w = 0;
    for (let i = 0; i < childIds.length; i++) {
      if (i > 0) w += NODE_GAP;
      w += getSubtreeWidth(childIds[i]);
    }
    return w;
  }

  function getSubtreeWidth(charId: string): number {
    if (widthCache.has(charId)) return widthCache.get(charId)!;
    if (computing.has(charId)) return NODE_SIZE; // cycle guard
    computing.add(charId);

    const unit = unitMap.get(charId);
    if (!unit) {
      widthCache.set(charId, NODE_SIZE);
      computing.delete(charId);
      return NODE_SIZE;
    }

    const cw = coupleWidth(unit);

    if (unit.childGroups.length === 0) {
      widthCache.set(charId, cw);
      computing.delete(charId);
      return cw;
    }

    // Children total width (groups separated by extra gap)
    let childrenW = 0;
    for (let gi = 0; gi < unit.childGroups.length; gi++) {
      if (gi > 0) childrenW += NODE_GAP * 2; // extra gap between groups
      childrenW += childGroupWidth(unit.childGroups[gi].childIds);
    }

    const w = Math.max(cw, childrenW);
    widthCache.set(charId, w);
    computing.delete(charId);
    return w;
  }

  // ─── Recursive placement ───

  const placedUnits = new Set<string>();

  function placeUnit(unitId: string, cx: number) {
    const unit = unitMap.get(unitId);
    if (!unit || placedUnits.has(unitId)) return;
    placedUnits.add(unitId);

    const y = unit.generation * GENERATION_HEIGHT;

    // If main char was already positioned (by a parent unit), use its position
    if (positions.has(unitId)) {
      cx = positions.get(unitId)!.x;
    } else {
      positions.set(unitId, { x: cx, y });
    }

    // ─── Place spouses ───
    const spouseXMap = new Map<string, number>(); // for child group sorting

    if (unit.spouseIds.length === 1) {
      const spId = unit.spouseIds[0];
      const spX = cx + NODE_SIZE + COUPLE_GAP;
      spouseXMap.set(spId, spX);
      if (!positions.has(spId)) {
        positions.set(spId, { x: spX, y });
      }
    } else if (unit.spouseIds.length >= 2) {
      // First spouse LEFT, rest RIGHT (alternating out)
      for (let i = 0; i < unit.spouseIds.length; i++) {
        const spId = unit.spouseIds[i];
        let spX: number;
        if (i === 0) {
          spX = cx - (NODE_SIZE + COUPLE_GAP);
        } else {
          spX = cx + i * (NODE_SIZE + COUPLE_GAP);
        }
        spouseXMap.set(spId, spX);
        if (!positions.has(spId)) {
          positions.set(spId, { x: spX, y });
        }
      }
    }

    // ─── Place children ───
    if (unit.childGroups.length === 0) return;

    // Sort child groups by their couple midpoint (left to right)
    const sortedGroups = [...unit.childGroups].sort((a, b) => {
      const aSpX = a.spouseId ? (spouseXMap.get(a.spouseId) ?? cx) : cx;
      const bSpX = b.spouseId ? (spouseXMap.get(b.spouseId) ?? cx) : cx;
      const aMid = (aSpX + cx) / 2;
      const bMid = (bSpX + cx) / 2;
      return aMid - bMid;
    });

    // Compute group widths
    const groupWidths = sortedGroups.map((g) => childGroupWidth(g.childIds));
    let totalChildrenW = 0;
    for (let i = 0; i < groupWidths.length; i++) {
      if (i > 0) totalChildrenW += NODE_GAP * 2;
      totalChildrenW += groupWidths[i];
    }

    // Center children under the unit
    let startX = cx - totalChildrenW / 2;

    for (let gi = 0; gi < sortedGroups.length; gi++) {
      if (gi > 0) startX += NODE_GAP * 2;
      const group = sortedGroups[gi];
      let childX = startX;

      for (const cid of group.childIds) {
        const cw = getSubtreeWidth(cid);
        const childCx = childX + cw / 2;
        const childY = (unit.generation + 1) * GENERATION_HEIGHT;

        if (!positions.has(cid)) {
          positions.set(cid, { x: childCx, y: childY });
        }

        // Recurse into child's own unit
        if (unitMap.has(cid)) {
          placeUnit(cid, childCx);
        }

        childX += cw + NODE_GAP;
      }

      startX += groupWidths[gi];
    }
  }

  // ─── Find root units ───
  const isChildOfUnit = new Set<string>();
  for (const u of units) {
    for (const g of u.childGroups) {
      for (const cid of g.childIds) isChildOfUnit.add(cid);
    }
  }
  const roots = units.filter((u) => !isChildOfUnit.has(u.id));
  if (roots.length === 0 && units.length > 0) roots.push(units[0]);

  // Sort roots by generation (topmost first)
  roots.sort((a, b) => a.generation - b.generation);

  // Compute widths
  for (const r of roots) getSubtreeWidth(r.id);

  // Place roots side by side
  const rootWidths = roots.map((r) => getSubtreeWidth(r.id));
  const totalRootW = rootWidths.reduce((a, b) => a + b, 0) + Math.max(0, roots.length - 1) * NODE_GAP * 3;
  let rx = -totalRootW / 2;

  for (let i = 0; i < roots.length; i++) {
    placeUnit(roots[i].id, rx + rootWidths[i] / 2);
    rx += rootWidths[i] + NODE_GAP * 3;
  }

  // ─── Place any remaining displayed characters ───
  for (const charId of displayed) {
    if (positions.has(charId)) continue;
    const gen = generations.get(charId) ?? 0;
    const y = gen * GENERATION_HEIGHT;
    let maxX = 0;
    for (const pos of positions.values()) {
      if (Math.abs(pos.y - y) < 1 && pos.x > maxX) maxX = pos.x;
    }
    positions.set(charId, { x: maxX + NODE_SIZE + NODE_GAP, y });
  }

  // ─── Center on centerId ───
  const cp = positions.get(centerId);
  if (cp) {
    const ox = cp.x;
    for (const p of positions.values()) p.x -= ox;
  }

  // Build result
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
  const nodes = computePositions(displayed, generations, units, centerId);
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
