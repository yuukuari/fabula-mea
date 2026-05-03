import type { Scene, Chapter } from '@/types';
import type { AnalysisScope, ReportResult, ScoreItem } from './types';
import { resolveScope, totalWordCount } from './manuscript-text';
import { detectRepetitions } from './repetitions';
import { detectAdverbs } from './adverbs';
import { detectDullVerbs } from './dull-verbs';
import { analyzeSentences } from './sentences';
import { analyzeLexical } from './lexical';

export type ReportStage =
  | 'resolve' | 'repetitions' | 'adverbs' | 'dull-verbs'
  | 'sentences' | 'lexical' | 'finalize';
export type ReportProgress = (stage: ReportStage, ratio: number) => void;

export const STAGE_LABELS: Record<ReportStage, string> = {
  'resolve': 'Préparation du texte',
  'repetitions': 'Détection des répétitions',
  'adverbs': 'Analyse des adverbes',
  'dull-verbs': 'Repérage des verbes ternes',
  'sentences': 'Longueur des phrases',
  'lexical': 'Variabilité lexicale',
  'finalize': 'Calcul des scores',
};

/** Aide contextuelle affichée dans le rapport quand on déplie une dimension. */
export interface DimensionHelp {
  /** Une phrase sur ce que mesure cette dimension. */
  what: string;
  /** Les seuils utilisés pour le score (idéal / gênant). */
  thresholds: string;
  /** Pistes concrètes pour améliorer le score. */
  howToImprove: string;
}

export const DIMENSION_HELP: Record<string, DimensionHelp> = {
  'repetitions': {
    what: "Mots pleins (≥ 5 lettres) qui reviennent souvent et de manière concentrée. Le score regarde la fenêtre de 500 mots la plus dense du texte et compte toutes les répétitions cumulées qu'elle contient — un paragraphe « saturé » est ainsi pénalisé même si le reste est propre.",
    thresholds: 'Score 100 si la fenêtre la plus dense contient moins de ~2 % de répétitions cumulées. Score 0 dès ~10 % (50 répétitions cumulées dans 500 mots).',
    howToImprove: "Cliquer sur un mot signalé pour voir où il se concentre. Reformuler localement, recourir aux synonymes (onglet Outils), ou supprimer une occurrence si elle n'apporte rien.",
  },
  'adverbs': {
    what: 'Adverbes en -ment (rapidement, doucement, soudainement…). Trop nombreux, ils alourdissent la prose et signalent souvent un verbe trop faible.',
    thresholds: 'Idéal autour de 1 % du texte. Gênant au-delà de 4 %.',
    howToImprove: "Remplacer « marcha rapidement » par « se précipita ». Quand un verbe a besoin d'un adverbe, c'est souvent qu'il existe un verbe plus précis.",
  },
  'dull-verbs': {
    what: 'Verbes passe-partout (être, avoir, faire, dire, mettre, voir, prendre, aller). Indispensables, mais à doser.',
    thresholds: 'Idéal sous 5 % des mots. Gênant au-delà de 15 %.',
    howToImprove: "Privilégier des verbes spécifiques : « il prit son sac » → « il empoigna son sac ». Pour les dialogues, varier les verbes de parole (murmura, lança, soupira) plutôt qu'enchaîner « dit ».",
  },
  'sentences': {
    what: 'Proportion de phrases longues (plus de 30 mots). Une bonne prose alterne des longueurs variées ; trop de phrases longues fatiguent le lecteur.',
    thresholds: 'Idéal : moins de 5 % des phrases au-dessus de 30 mots. Gênant : plus de 25 %.',
    howToImprove: 'Cliquer sur une phrase pour la situer dans le manuscrit. La couper en deux, retirer une subordonnée, ou la rythmer avec une virgule, un point-virgule ou un tiret.',
  },
  'lexical': {
    what: "Diversité du vocabulaire : ratio entre lemmes uniques (mots pleins regroupés par racine) et nombre total de mots pleins. Plus le ratio est élevé, plus le texte est varié.",
    thresholds: 'Idéal ≥ 0.55. Gênant ≤ 0.25. Note : le ratio baisse mécaniquement sur les longs textes (mêmes mots qui reviennent), donc un score correct sur un livre entier reste plus difficile à atteindre que sur une scène.',
    howToImprove: "Repérer les mots qui reviennent (section Répétitions au-dessus), introduire des synonymes, varier les structures. Sur un long texte, viser surtout à ne pas surcharger le même paragraphe ou la même page.",
  },
};

/** Convertit un ratio observé en score 0-100, par interpolation vs deux seuils. */
function rangeScore(value: number, ideal: number, bad: number): number {
  if (ideal === bad) return 100;
  const t = (value - ideal) / (bad - ideal);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round((1 - clamped) * 100);
}

export function buildReport(
  scope: AnalysisScope,
  scenes: Scene[],
  chapters: Chapter[],
  onProgress?: ReportProgress,
): ReportResult {
  onProgress?.('resolve', 0);
  const resolved = resolveScope(scope, scenes, chapters);
  const total = totalWordCount(resolved.pieces);

  onProgress?.('repetitions', 0.15);
  const repAnalysis = detectRepetitions(resolved.pieces);
  const repetitions = repAnalysis.items;
  onProgress?.('adverbs', 0.35);
  const adverbs = detectAdverbs(resolved.pieces);
  onProgress?.('dull-verbs', 0.5);
  const dullVerbs = detectDullVerbs(resolved.pieces);
  onProgress?.('sentences', 0.65);
  const sentences = analyzeSentences(resolved.pieces);
  onProgress?.('lexical', 0.85);
  const lexical = analyzeLexical(resolved.pieces);
  onProgress?.('finalize', 0.95);

  // Densités rapportées au total de mots
  const repHits = repetitions.reduce((s, r) => s + r.count, 0);
  // Pour le score Répétitions, on prend la **densité maximale** observée dans
  // une fenêtre glissante de `windowSize` mots, en cumulant TOUS les mots
  // répétés. Cela capture la sensation de "paragraphe saturé" : un texte
  // dupliqué quatre fois cumule toutes les répétitions dans la même zone.
  // Borné par `windowSize` quand le texte est plus court que la fenêtre.
  const burstWindow = Math.min(repAnalysis.windowSize, Math.max(1, total));
  const repDensity = burstWindow > 0 ? repAnalysis.maxBurst / burstWindow : 0;
  const advCount = adverbs.reduce((s, a) => s + a.count, 0);
  const advDensity = total > 0 ? advCount / total : 0;
  const dullCount = dullVerbs.reduce((s, v) => s + v.count, 0);
  const dullDensity = total > 0 ? dullCount / total : 0;

  const scores: ScoreItem[] = [];

  // Répétitions : idéal 0%, gênant ≥ 8%
  scores.push({
    key: 'repetitions',
    label: 'Répétitions',
    score: total > 0 ? rangeScore(repDensity, 0.02, 0.1) : 100,
    detail: repetitions.length === 0
      ? `Aucune répétition concentrée détectée sur ${total.toLocaleString('fr-FR')} mots.`
      : `${repetitions.length} mots concentrés, ${repHits} occurrences au total. Pic de densité : ${repAnalysis.maxBurst} répétitions cumulées dans ${repAnalysis.windowSize} mots consécutifs.`,
  });

  // Adverbes en -ment : idéal 1%, gênant ≥ 4%
  scores.push({
    key: 'adverbs',
    label: 'Adverbes en -ment',
    score: total > 0 ? rangeScore(advDensity, 0.01, 0.04) : 100,
    detail: `${advCount} adverbe${advCount > 1 ? 's' : ''} en -ment (${(advDensity * 100).toFixed(1)} %).`,
  });

  // Verbes ternes : idéal 5%, gênant ≥ 15%
  scores.push({
    key: 'dull-verbs',
    label: 'Verbes ternes',
    score: total > 0 ? rangeScore(dullDensity, 0.05, 0.15) : 100,
    detail: `${dullCount} occurrences de verbes ternes (être, avoir, faire, dire…).`,
  });

  // Phrases longues : idéal 5%, gênant ≥ 25%
  scores.push({
    key: 'sentences',
    label: 'Longueur des phrases',
    score: sentences.count > 0 ? rangeScore(sentences.longRatio, 0.05, 0.25) : 100,
    detail: sentences.count > 0
      ? `Moyenne ${sentences.averageWords} mots/phrase, ${(sentences.longRatio * 100).toFixed(0)} % au-dessus de 30 mots.`
      : 'Aucune phrase détectée.',
  });

  // Variabilité lexicale : idéal ≥ 0.55, gênant ≤ 0.25 (inversé)
  const lexScore = total > 0 ? rangeScore(0.55 - lexical.ratio, 0, 0.3) : 100;
  scores.push({
    key: 'lexical',
    label: 'Variabilité lexicale',
    score: lexScore,
    detail: `${lexical.uniqueWords} lemmes uniques sur ${lexical.totalWords} mots pleins (ratio ${lexical.ratio.toFixed(2)}).`,
  });

  const globalScore = scores.length > 0
    ? Math.round(scores.reduce((s, sc) => s + sc.score, 0) / scores.length)
    : 100;

  return {
    scope,
    totalWords: total,
    generatedAt: new Date().toISOString(),
    globalScore,
    scores,
    repetitions,
    adverbs,
    dullVerbs,
    sentences,
    lexical,
  };
}
