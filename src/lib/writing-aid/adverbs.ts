import type { ScenePiece, AdverbItem, WordHit } from './types';

// Faux positifs les plus courants : noms en -ment qui ne sont pas des adverbes.
const NOT_ADVERBS = new Set<string>([
  'moment', 'ciment', 'firmament', 'sentiment', 'testament', 'document',
  'logement', 'mouvement', 'vêtement', 'changement', 'engagement', 'instrument',
  'régiment', 'segment', 'fragment', 'élément', 'aliment', 'gouvernement',
  'jugement', 'parlement', 'monument', 'pigment', 'piment', 'tempérament',
  'compliment', 'complément', 'argument', 'amendement', 'enseignement',
  'événement', 'evenement', 'fondement', 'établissement', 'environnement',
  'développement', 'comportement', 'investissement', 'stationnement',
  'appartement', 'département', 'commencement', 'rassemblement',
  'gisement', 'élargissement', 'épanouissement', 'enrichissement',
  'placement', 'serment', 'tournoiement', 'aboiement', 'bâtiment',
  'lent', 'véhément', 'évident', 'récent', 'présent', // suffixe -ent simple
]);

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
      if (NOT_ADVERBS.has(lower)) continue;
      // Heuristique : un adverbe en -ment se termine généralement par
      // une consonne + "ement" ou voyelle + "ment" (ex: rapidement, vraiment)
      // On exclut les mots qui se terminent par "ament" ou "ement" précédés d'une consonne
      // mais on garde la majorité — le filtre NOT_ADVERBS gère les exceptions courantes.
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
