import type { ScenePiece, LexicalAnalysis } from './types';
import { FR_STOPWORDS, lightStem } from './stopwords';

/** Variabilité lexicale : ratio mots uniques (lemmatisés, hors stop-words) / mots totaux pleins. */
export function analyzeLexical(pieces: ScenePiece[]): LexicalAnalysis {
  const seen = new Set<string>();
  let total = 0;

  for (const piece of pieces) {
    if (!piece.text) continue;
    const matches = piece.text.match(/\p{L}+/gu);
    if (!matches) continue;
    for (const w of matches) {
      const lower = w.toLowerCase();
      if (FR_STOPWORDS.has(lower)) continue;
      if (lower.length < 3) continue;
      total++;
      seen.add(lightStem(lower));
    }
  }

  return {
    totalWords: total,
    uniqueWords: seen.size,
    ratio: total > 0 ? seen.size / total : 0,
  };
}
