/**
 * Analyse de ponctuation : signale les abus de "…", "!" et italiques.
 * Chaque ligne est désactivable individuellement par livre (catchphrase voulue,
 * style assumé) — voir `WritingAidSettings.disabledPunctuation`.
 *
 * - Ellipses : occurrences de "…" ou "...".
 * - Exclamations : "!" simples.
 * - Multi-exclamations : "!!" ou plus (souvent l'abus le plus marquant).
 * - Italiques : nombre de **mots** dans des balises <em>/<i> (HTML brut).
 */
import type { PunctuationStats } from './types';

const ITALIC_TAG_RE = /<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const TAG_RE = /<[^>]+>/g;

function countWords(text: string): number {
  const m = text.match(/\p{L}+/gu);
  return m ? m.length : 0;
}

export function analyzePunctuation(plainText: string, html: string): PunctuationStats {
  // Ellipses : "…" ou "..." (3+ points consécutifs)
  const ellipses =
    (plainText.match(/…/g)?.length ?? 0)
    + (plainText.match(/\.{3,}/g)?.length ?? 0);

  // Exclamations : on compte d'abord les groupes de "!" (1, 2, 3+)
  const exclMatches = plainText.match(/!+/g) ?? [];
  let exclamations = 0;
  let multiExclamations = 0;
  for (const e of exclMatches) {
    if (e.length === 1) exclamations++;
    else multiExclamations++;
  }

  // Italiques : compte les mots dans chaque <em>/<i>
  let italicWords = 0;
  let m: RegExpExecArray | null;
  ITALIC_TAG_RE.lastIndex = 0;
  while ((m = ITALIC_TAG_RE.exec(html)) !== null) {
    // Le contenu peut imbriquer d'autres balises (rare en TipTap mais possible)
    const inner = m[2].replace(TAG_RE, ' ');
    italicWords += countWords(inner);
  }

  const totalWords = countWords(plainText);
  return { ellipses, exclamations, multiExclamations, italicWords, totalWords };
}
