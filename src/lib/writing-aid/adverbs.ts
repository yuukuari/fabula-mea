import type { ScenePiece, AdverbItem, WordHit } from './types';
import { ADVERBS_FR } from './adverbs-whitelist';

export function detectAdverbs(pieces: ScenePiece[]): AdverbItem[] {
  const byWord = new Map<string, WordHit[]>();
  const re = /\p{L}+/gu;

  for (const piece of pieces) {
    if (!piece.text) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(piece.text)) !== null) {
      const word = m[0];
      const lower = word.toLowerCase();
      if (!lower.endsWith('ment') || lower.length < 6) continue;
      if (!ADVERBS_FR.has(lower)) continue;
      const list = byWord.get(lower);
      const hit: WordHit = { sceneId: piece.sceneId, chapterId: piece.chapterId, offset: m.index, word };
      if (list) list.push(hit);
      else byWord.set(lower, [hit]);
    }
  }

  const items: AdverbItem[] = [];
  for (const [word, hits] of byWord) {
    items.push({ word, count: hits.length, hits });
  }
  items.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'fr'));
  return items;
}
