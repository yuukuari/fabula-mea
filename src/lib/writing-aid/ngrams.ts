/**
 * Détection des « tics de langage » : n-grammes (2-3 mots) répétés dans le
 * manuscrit. Plus puissant que la détection de mots seuls : capture les
 * tournures comme « il y avait », « ne put s'empêcher de », etc.
 *
 * Filtrage : on ignore les n-grammes composés exclusivement de stopwords (sinon
 * on remonte « il y a », « ce qui », « de la »…). Au moins un mot du n-gramme
 * doit être un mot plein (≥ 4 lettres et hors stopwords).
 *
 * Comme `repetitions.ts`, utilise une fenêtre glissante pour mesurer la
 * concentration locale et écarter les n-grammes diluées sur tout un livre.
 */
import type { ScenePiece, NgramAnalysis, NgramItem, PhraseHit } from './types';

export interface NgramOptions {
  /** Tailles de n-grammes à analyser (défaut [2, 3]). */
  sizes?: number[];
  /** Nombre minimum d'occurrences brutes (défaut 3). */
  minCount?: number;
  /** Concentration minimale dans la fenêtre glissante (défaut 2). */
  minWindowCount?: number;
  /** Fenêtre glissante en mots (défaut 1000 — plus large que pour les mots seuls). */
  windowSize?: number;
  /** Nombre max d'éléments retournés (défaut 30). */
  maxItems?: number;
}

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

function normalizeToken(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function detectNgrams(
  pieces: ScenePiece[],
  opts: NgramOptions = {},
): NgramAnalysis {
  const sizes = opts.sizes ?? [2, 3];
  const minCount = opts.minCount ?? 3;
  const minWindowCount = opts.minWindowCount ?? 2;
  const windowSize = opts.windowSize ?? 1000;
  const maxItems = opts.maxItems ?? 30;

  // 1. Tokenisation globale : on stocke (mot, sceneId, chapterId) avec son
  //    index global (toutes scènes concaténées).
  interface Token { norm: string; lower: string; raw: string; sceneId: string; chapterId: string; }
  const tokens: Token[] = [];
  for (const piece of pieces) {
    if (!piece.text) continue;
    const re = /\p{L}+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(piece.text)) !== null) {
      tokens.push({
        norm: normalizeToken(m[0]),
        lower: m[0].toLowerCase(),
        raw: m[0],
        sceneId: piece.sceneId,
        chapterId: piece.chapterId,
      });
    }
  }

  if (tokens.length === 0) {
    return { items: [], totalRepeats: 0, windowSize };
  }

  const byKey = new Map<string, {
    size: number;
    text: string;
    indices: number[];
    hits: PhraseHit[];
  }>();

  for (const size of sizes) {
    for (let i = 0; i + size <= tokens.length; i++) {
      const slice = tokens.slice(i, i + size);
      // Rejette les n-grammes qui traversent une frontière de scène
      // (artefact de la concaténation des tokens de toutes les scènes en un
      // flux unique). Sans ce filtre, un 3-gramme « fin-scène-A + début-
      // scène-B » serait listé mais introuvable dans le texte → 0 occurrence
      // dans le navigateur de hits.
      const sceneId = slice[0].sceneId;
      let sameScene = true;
      for (let k = 1; k < slice.length; k++) {
        if (slice[k].sceneId !== sceneId) { sameScene = false; break; }
      }
      if (!sameScene) continue;
      // Filtre : au moins un mot ≥ 4 lettres. On NE rejette PAS les
      // n-grammes formés uniquement de stopwords longs (« il y avait »,
      // « ne put s'empêcher ») — ce sont précisément les tics qu'on veut
      // attraper. Le filtre exclut seulement les enchaînements de mots
      // courts type « il y a », « de la », « ce qui » qui n'apportent rien.
      const hasLongWord = slice.some((t) => t.lower.length >= 4);
      if (!hasLongWord) continue;

      const key = `${size}|${slice.map((t) => t.norm).join(' ')}`;
      const text = slice.map((t) => t.raw).join(' ');
      const entry = byKey.get(key);
      const hit: PhraseHit = {
        sceneId: slice[0].sceneId,
        chapterId: slice[0].chapterId,
        text,
      };
      if (entry) {
        entry.indices.push(i);
        entry.hits.push(hit);
      } else {
        byKey.set(key, { size, text, indices: [i], hits: [hit] });
      }
    }
  }

  const items: NgramItem[] = [];
  for (const [key, e] of byKey.entries()) {
    if (e.indices.length < minCount) continue;
    const maxWindowCount = maxConcentration(e.indices, windowSize);
    if (maxWindowCount < minWindowCount) continue;
    items.push({
      key,
      text: e.text,
      size: e.size,
      count: e.indices.length,
      maxWindowCount,
      windowSize,
      hits: e.hits,
    });
  }

  // Tri : taille (3 d'abord, plus marquant), puis concentration, puis count.
  items.sort((a, b) =>
    b.size - a.size
    || b.maxWindowCount - a.maxWindowCount
    || b.count - a.count
    || a.text.localeCompare(b.text, 'fr')
  );

  const totalRepeats = items.reduce((s, it) => s + (it.count - 1), 0);

  return { items: items.slice(0, maxItems), totalRepeats, windowSize };
}
