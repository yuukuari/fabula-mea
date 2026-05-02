import type { ScenePiece, RepetitionItem, WordHit } from './types';
import { FR_STOPWORDS, lightStem } from './stopwords';

export interface RepetitionOptions {
  /** Longueur minimale du mot (par défaut 5). */
  minLength?: number;
  /** Nombre minimum d'occurrences pour signaler (par défaut 3). */
  minCount?: number;
  /** Nombre max d'éléments retournés (par défaut 50). */
  maxItems?: number;
}

interface RawHit extends WordHit {
  stem: string;
}

/** Détecte les répétitions à travers un manuscrit (scope = liste de scènes).
 *  Regroupe par lemme léger (lightStem) pour fusionner pluriels/conjugaisons. */
export function detectRepetitions(
  pieces: ScenePiece[],
  opts: RepetitionOptions = {},
): RepetitionItem[] {
  const minLength = opts.minLength ?? 5;
  const minCount = opts.minCount ?? 3;
  const maxItems = opts.maxItems ?? 50;

  const byStem = new Map<string, { display: string; hits: RawHit[] }>();

  for (const piece of pieces) {
    const text = piece.text;
    if (!text) continue;
    const re = /\p{L}+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const word = m[0];
      const lower = word.toLowerCase();
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
        stem,
      };
      if (entry) {
        entry.hits.push(hit);
      } else {
        byStem.set(stem, { display: lower, hits: [hit] });
      }
    }
  }

  const items: RepetitionItem[] = [];
  for (const { display, hits } of byStem.values()) {
    if (hits.length < minCount) continue;
    items.push({
      word: display,
      count: hits.length,
      hits: hits.map(({ stem: _stem, ...h }) => h),
    });
  }
  items.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'fr'));
  return items.slice(0, maxItems);
}
