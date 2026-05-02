import type { ScenePiece, DullVerbItem, WordHit } from './types';

// Verbes ternes : formes conjuguées les plus fréquentes regroupées par lemme.
// Volontairement non-exhaustif — vise les sur-emplois patents.
const DULL: Record<string, string[]> = {
  être: ['être', 'suis', 'es', 'est', 'sommes', 'êtes', 'sont', 'étais', 'était', 'étions', 'étiez', 'étaient', 'serai', 'seras', 'sera', 'serons', 'serez', 'seront', 'serais', 'serait', 'serions', 'seriez', 'seraient', 'sois', 'soit', 'soyons', 'soyez', 'soient', 'fus', 'fut', 'fûmes', 'fûtes', 'furent'],
  avoir: ['avoir', 'ai', 'as', 'a', 'avons', 'avez', 'ont', 'avais', 'avait', 'avions', 'aviez', 'avaient', 'aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront', 'aurais', 'aurait', 'aurions', 'auriez', 'auraient', 'aie', 'aies', 'ait', 'ayons', 'ayez', 'aient', 'eus', 'eut', 'eûmes', 'eûtes', 'eurent'],
  faire: ['faire', 'fais', 'fait', 'faisons', 'faites', 'font', 'faisais', 'faisait', 'faisions', 'faisiez', 'faisaient', 'ferai', 'feras', 'fera', 'ferons', 'ferez', 'feront', 'ferais', 'ferait', 'ferions', 'feriez', 'feraient', 'fasse', 'fasses', 'fassions', 'fassiez', 'fassent', 'fis', 'fit', 'fîmes', 'fîtes', 'firent'],
  dire: ['dire', 'dis', 'dit', 'disons', 'dites', 'disent', 'disais', 'disait', 'disions', 'disiez', 'disaient', 'dirai', 'diras', 'dira', 'dirons', 'direz', 'diront', 'dirais', 'dirait', 'dirions', 'diriez', 'diraient', 'dise', 'dises', 'disent'],
  mettre: ['mettre', 'mets', 'met', 'mettons', 'mettez', 'mettent', 'mettais', 'mettait', 'mettions', 'mettiez', 'mettaient', 'mis', 'mise', 'mises', 'mit', 'mîmes', 'mîtes', 'mirent', 'mettrai', 'mettra', 'mettrait'],
  voir: ['voir', 'vois', 'voit', 'voyons', 'voyez', 'voient', 'voyais', 'voyait', 'voyions', 'voyiez', 'voyaient', 'verrai', 'verras', 'verra', 'verrons', 'verrez', 'verront', 'vis', 'vit', 'vîmes', 'vîtes', 'virent', 'vu', 'vus', 'vue', 'vues'],
  prendre: ['prendre', 'prends', 'prend', 'prenons', 'prenez', 'prennent', 'prenais', 'prenait', 'prenions', 'preniez', 'prenaient', 'pris', 'prit', 'prîmes', 'prîtes', 'prirent', 'prendrai', 'prendra', 'prendrait', 'prise', 'prises'],
  aller: ['aller', 'vais', 'vas', 'va', 'allons', 'allez', 'vont', 'allais', 'allait', 'allions', 'alliez', 'allaient', 'irai', 'iras', 'ira', 'irons', 'irez', 'iront', 'irais', 'irait', 'irions', 'iriez', 'iraient'],
};

export function detectDullVerbs(pieces: ScenePiece[]): DullVerbItem[] {
  const formToLemma = new Map<string, string>();
  for (const [lemma, forms] of Object.entries(DULL)) {
    for (const f of forms) formToLemma.set(f.toLowerCase(), lemma);
  }

  const byLemma = new Map<string, WordHit[]>();
  const re = /\p{L}+/gu;
  for (const piece of pieces) {
    if (!piece.text) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(piece.text)) !== null) {
      const lower = m[0].toLowerCase();
      const lemma = formToLemma.get(lower);
      if (!lemma) continue;
      const list = byLemma.get(lemma);
      const hit: WordHit = { sceneId: piece.sceneId, chapterId: piece.chapterId, offset: m.index, word: m[0] };
      if (list) list.push(hit);
      else byLemma.set(lemma, [hit]);
    }
  }

  const items: DullVerbItem[] = [];
  for (const [word, hits] of byLemma) items.push({ word, count: hits.length, hits });
  items.sort((a, b) => b.count - a.count);
  return items;
}
