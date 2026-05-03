import type { ScenePiece, RepetitionItem, RepetitionAnalysis, WordHit } from './types';
import { FR_STOPWORDS, lightStem } from './stopwords';

export interface RepetitionOptions {
  /** Longueur minimale du mot (par défaut 5). */
  minLength?: number;
  /** Nombre minimum d'occurrences brutes pour signaler (par défaut 3). */
  minCount?: number;
  /** Concentration minimale dans la fenêtre glissante pour signaler (par défaut 3).
   *  Permet d'écarter les répétitions diluées sur tout un livre. */
  minWindowCount?: number;
  /** Taille de la fenêtre glissante pour évaluer la densité locale (par défaut 500 mots). */
  windowSize?: number;
  /** Nombre max d'éléments retournés (par défaut 50). */
  maxItems?: number;
}

/** Plus grand nombre d'indices contenus dans une fenêtre glissante de taille
 *  `window`, étant donné des indices globaux croissants. */
function maxConcentration(indices: number[], window: number): number {
  if (indices.length === 0) return 0;
  let max = 1;
  let j = 0;
  for (let i = 0; i < indices.length; i++) {
    while (indices[i] - indices[j] >= window) j++;
    const span = i - j + 1;
    if (span > max) max = span;
  }
  return max;
}

interface RawHit extends WordHit {
  /** Index global du mot dans le manuscrit complet (toutes scènes concaténées). */
  globalIndex: number;
}

/** Détecte les répétitions à travers un manuscrit (scope = liste de scènes).
 *  Regroupe par lemme léger (lightStem) pour fusionner pluriels/conjugaisons.
 *
 *  Renvoie aussi `maxBurst` : la concentration maximale, **toutes répétitions
 *  confondues**, dans la fenêtre la plus dense. C'est cette métrique globale
 *  qui pilote le score (un paragraphe dupliqué N fois cumule TOUTES les
 *  répétitions dans la même fenêtre, ce que la simple somme par mot ne
 *  capturait pas).
 */
export function detectRepetitions(
  pieces: ScenePiece[],
  opts: RepetitionOptions = {},
): RepetitionAnalysis {
  const minLength = opts.minLength ?? 5;
  const minCount = opts.minCount ?? 3;
  const minWindowCount = opts.minWindowCount ?? 3;
  const windowSize = opts.windowSize ?? 500;
  const maxItems = opts.maxItems ?? 50;

  const byStem = new Map<string, { display: string; hits: RawHit[] }>();

  let globalIndex = 0;
  for (const piece of pieces) {
    const text = piece.text;
    if (!text) continue;
    const re = /\p{L}+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const word = m[0];
      const lower = word.toLowerCase();
      const idx = globalIndex++;
      if (lower.length < minLength) continue;
      if (FR_STOPWORDS.has(lower)) continue;
      const stem = lightStem(lower);
      if (!stem || FR_STOPWORDS.has(stem)) continue;
      const entry = byStem.get(stem);
      const hit: RawHit = {
        sceneId: piece.sceneId,
        chapterId: piece.chapterId,
        offset: m.index,
        word,
        globalIndex: idx,
      };
      if (entry) {
        entry.hits.push(hit);
      } else {
        byStem.set(stem, { display: lower, hits: [hit] });
      }
    }
  }

  const items: RepetitionItem[] = [];
  // On collecte aussi tous les indices globaux des hits "validés" pour
  // calculer le burst global ensuite.
  const burstIndices: number[] = [];

  for (const { display, hits } of byStem.values()) {
    if (hits.length < minCount) continue;
    const indices = hits.map((h) => h.globalIndex);
    const maxWindowCount = maxConcentration(indices, windowSize);
    if (maxWindowCount < minWindowCount) continue;
    items.push({
      word: display,
      count: hits.length,
      maxWindowCount,
      windowSize,
      hits: hits.map(({ globalIndex: _gi, ...h }) => h),
    });
    burstIndices.push(...indices);
  }

  // Tri : concentration locale d'abord (plus problématique), puis count brut.
  items.sort((a, b) =>
    b.maxWindowCount - a.maxWindowCount
    || b.count - a.count
    || a.word.localeCompare(b.word, 'fr')
  );

  // Calcul du burst global : on trie les indices et on glisse la fenêtre.
  burstIndices.sort((a, b) => a - b);
  const maxBurst = maxConcentration(burstIndices, windowSize);

  return {
    items: items.slice(0, maxItems),
    maxBurst,
    windowSize,
  };
}
