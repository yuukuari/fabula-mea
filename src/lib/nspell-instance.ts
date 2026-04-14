/**
 * Singleton nspell (Hunspell) instance for French spellchecking.
 *
 * Loads the .aff/.dic files from /dictionaries/ via fetch (browser-compatible).
 * Provides helpers to add/remove custom words and check/suggest.
 */
import NSpell from 'nspell';

let instance: ReturnType<typeof NSpell> | null = null;
let initPromise: Promise<ReturnType<typeof NSpell>> | null = null;

/** Lazily initialise the spellchecker (called once, then cached). */
export function initSpellChecker(): Promise<ReturnType<typeof NSpell>> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [affRes, dicRes] = await Promise.all([
      fetch('/dictionaries/fr.aff'),
      fetch('/dictionaries/fr.dic'),
    ]);
    if (!affRes.ok || !dicRes.ok) throw new Error('Failed to load French dictionary');
    const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
    instance = NSpell(aff, dic);
    return instance;
  })();

  return initPromise;
}

/** Get the cached instance (null if not yet loaded). */
export function getSpellChecker(): ReturnType<typeof NSpell> | null {
  return instance;
}

/** Load a batch of custom words into the spellchecker. */
export function loadCustomWords(words: string[]): void {
  if (!instance) return;
  for (const w of words) {
    if (w) instance.add(w);
  }
}

/** Add a single word at runtime. */
export function addWord(word: string): void {
  if (!instance || !word) return;
  instance.add(word);
}

/** Remove a single word at runtime. */
export function removeWord(word: string): void {
  if (!instance || !word) return;
  instance.remove(word);
}

// ── French word tokeniser ──────────────────────────────────────
// Handles elision (l', d', j', qu', …) and compound words (peut-être).

const ELISION_RE = /^[ldjnsmctLDJNSMCT]'|^[Qq]u'/;

export interface WordToken {
  word: string;
  offset: number;
  length: number;
}

/** Tokenise a plain-text string into word tokens with offsets. */
export function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  // Match sequences of word characters including hyphens and apostrophes
  const re = /[a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ''\-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let word = m[0];
    let offset = m.index;

    // Strip trailing hyphens/apostrophes
    while (word.endsWith('-') || word.endsWith("'") || word.endsWith('\u2019')) {
      word = word.slice(0, -1);
    }
    if (word.length <= 1) continue;

    // For elided forms like l'homme, d'abord → check "homme", "abord"
    // But first check the full form (for words like aujourd'hui)
    tokens.push({ word, offset, length: word.length });

    // Also add the part after elision if applicable
    const elision = word.match(ELISION_RE);
    if (elision) {
      const after = word.slice(elision[0].length);
      if (after.length > 1) {
        tokens.push({
          word: after,
          offset: offset + elision[0].length,
          length: after.length,
        });
      }
    }
  }
  return tokens;
}
