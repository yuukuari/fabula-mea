// Mots vides FR — articles, prépositions, conjonctions, pronoms, auxiliaires fréquents.
// Liste volontairement courte (la lemmatisation light fait le reste).

export const FR_STOPWORDS = new Set<string>([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux',
  'et', 'ou', 'ni', 'mais', 'or', 'donc', 'car',
  'que', 'qui', 'quoi', 'dont', 'où',
  'ce', 'cet', 'cette', 'ces', 'celui', 'celle', 'ceux', 'celles',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'votre', 'leur', 'nos', 'vos', 'leurs',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'lui', 'leur', 'y', 'en',
  'moi', 'toi', 'soi',
  'à', 'a', 'dans', 'par', 'pour', 'sur', 'sous', 'avec', 'sans', 'chez',
  'vers', 'entre', 'contre', 'depuis', 'pendant', 'avant', 'après', 'devant', 'derrière',
  'comme', 'si', 'quand', 'lorsque', 'puisque', 'parce',
  'ne', 'pas', 'plus', 'jamais', 'rien', 'aucun', 'aucune', 'point',
  'très', 'trop', 'peu', 'assez', 'bien', 'mal', 'aussi', 'encore', 'déjà',
  'tout', 'tous', 'toute', 'toutes', 'même', 'mêmes',
  // auxiliaires & verbes très fréquents (forme lemmatisée légère)
  'être', 'avoir', 'faire', 'aller', 'pouvoir', 'vouloir', 'devoir',
  'est', 'es', 'sont', 'était', 'étaient', 'sera', 'seront', 'soit',
  'ai', 'as', 'a', 'avons', 'avez', 'ont', 'avait', 'avaient', 'aura', 'auront',
  'fait', 'faits', 'faite', 'faites', 'font', 'faisait', 'faisaient',
  'va', 'vas', 'vais', 'vont', 'allait', 'allaient',
  // articles élidés / contractions courantes après nettoyage apostrophe
  'l', 's', 't', 'm', 'n', 'qu', 'j', 'c',
  // adverbes très neutres
  'oui', 'non', 'voici', 'voilà', 'puis', 'alors', 'enfin', 'ainsi',
]);

/** Renvoie une racine très grossière pour grouper singuliers/pluriels et conjugaisons usuelles.
 *  Pas une vraie lemmatisation — but : fusionner « roi/rois », « mangeait/mangeaient ». */
export function lightStem(word: string): string {
  let w = word.toLowerCase();
  // normalize accents to keep mots distincts par accent (pas de NFD)
  // Remove common verb endings first (ordre important)
  const verbSuffixes = [
    'aient', 'aies', 'eraient', 'erais', 'erait', 'erions', 'eriez',
    'erons', 'erez', 'eront', 'aient', 'asses', 'âtes', 'âmes',
    'erai', 'eras', 'era', 'iez', 'ions', 'ais', 'ait',
    'ent', 'ons', 'ez', 'es', 'er', 'ir', 're',
  ];
  for (const suf of verbSuffixes) {
    if (w.length > suf.length + 2 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; }
  }
  // Pluriels / féminins
  if (w.endsWith('aux')) return w.slice(0, -3) + 'al';
  if (w.endsWith('eux')) return w.slice(0, -1);
  if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}
