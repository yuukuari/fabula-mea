import type { Scene, Chapter } from '@/types';
import type { AnalysisScope, ReportResult, ScoreItem, RepetitionItem, NgramItem, PunctuationStats } from './types';
import { resolveScope, resolvedScopeHtml, totalWordCount } from './manuscript-text';
import { detectRepetitions } from './repetitions';
import { detectAdverbs } from './adverbs';
import { detectDullVerbs } from './dull-verbs';
import { detectNgrams } from './ngrams';
import { analyzeSentences } from './sentences';
import { analyzeLexical } from './lexical';
import { analyzePunctuation } from './punctuation';

export type ReportStage =
  | 'resolve' | 'repetitions' | 'ngrams' | 'adverbs' | 'dull-verbs'
  | 'sentences' | 'lexical' | 'punctuation' | 'finalize';
export type ReportProgress = (stage: ReportStage, ratio: number) => void;

export const STAGE_LABELS: Record<ReportStage, string> = {
  'resolve': 'Préparation du texte',
  'repetitions': 'Détection des répétitions',
  'ngrams': 'Tics de langage',
  'adverbs': 'Analyse des adverbes',
  'dull-verbs': 'Repérage des verbes ternes',
  'sentences': 'Longueur des phrases',
  'lexical': 'Variabilité lexicale',
  'punctuation': 'Ponctuation',
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
  'ngrams': {
    what: "Tics de langage : suites de 2 ou 3 mots qui reviennent à plusieurs reprises (« il y avait », « ne put s'empêcher de »…). Plus difficiles à repérer à l'œil nu que les mots seuls, ces tournures donnent une signature stylistique répétitive.",
    thresholds: "Idéal sous 1 % de mots dans une tournure répétée. Gênant au-delà de 4 %.",
    howToImprove: "Cliquer sur un tic pour voir où il se concentre. Reformuler les passages les plus saturés, varier la structure des phrases (sujet en tête / inversion / proposition d'ouverture).",
  },
  'punctuation': {
    what: "Abus typiques de ponctuation et de mise en forme : points de suspension, points d'exclamation (simples et multiples « !! »), italiques. Trop nombreux, ils tirent l'œil et fatiguent le lecteur.",
    thresholds: "Idéal cumulé ≤ 1 ‰ de la longueur du texte (ellipses + exclamations + italiques rapportés aux mots). Gênant ≥ 1 %. Note : le seuil est volontairement large — désactivez la section si votre genre l'assume (thriller, dialogue théâtral…).",
    howToImprove: "Préférer un point ou un tiret cadratin à une exclamation. Les italiques pour insister gagnent à être réservés aux titres, mots étrangers et pensées rapportées.",
  },
};

/** Convertit un ratio observé en score 0-100, par interpolation vs deux seuils. */
export function rangeScore(value: number, ideal: number, bad: number): number {
  if (ideal === bad) return 100;
  const t = (value - ideal) / (bad - ideal);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round((1 - clamped) * 100);
}

// ── Re-scoring des dimensions filtrables ─────────────────────────
// Quand l'utilisateur désactive certains items (« ne pas comptabiliser cette
// répétition / ce tic / cette ponctuation »), on recalcule le score à partir
// des items restants. Les helpers ci-dessous sont déterministes à partir des
// items (pas du `maxBurst` global du worker) pour permettre la recomputation
// côté UI sans relancer l'analyse. Conséquence : pour les répétitions, on
// utilise un proxy (somme des concentrations max) qui **diverge légèrement**
// de la métrique du worker même quand rien n'est filtré. C'est acceptable —
// l'écart est marginal et l'intuition (« plus on coche, plus le score monte »)
// reste correcte.

/** Re-score Répétitions sur items filtrés. Quand `kept === all`, on retombe
 *  exactement sur le score du worker (basé sur `maxBurst / windowSize`).
 *  Quand des items sont désactivés, on scale `maxBurst` par le ratio des
 *  occurrences restantes — proxy raisonnable sans relancer l'analyse. */
export function repetitionScoreFromItems(
  kept: RepetitionItem[],
  all: RepetitionItem[],
  maxBurst: number,
  windowSize: number,
  total: number,
): number {
  if (total === 0) return 100;
  const totalCount = all.reduce((s, i) => s + i.count, 0);
  const keptCount = kept.reduce((s, i) => s + i.count, 0);
  const ratio = totalCount > 0 ? keptCount / totalCount : 0;
  const adjustedBurst = maxBurst * ratio;
  const burstWindow = Math.min(windowSize, Math.max(1, total));
  const density = burstWindow > 0 ? adjustedBurst / burstWindow : 0;
  return rangeScore(density, 0.02, 0.10);
}

export function ngramScoreFromItems(items: NgramItem[], total: number): number {
  if (total === 0) return 100;
  const totalRepeats = items.reduce((s, it) => s + (it.count - 1), 0);
  const density = totalRepeats / total;
  return rangeScore(density, 0.01, 0.04);
}

export interface PunctuationActive {
  ellipses: boolean;
  exclamations: boolean;
  multiExclamations: boolean;
  italicWords: boolean;
}

export function punctuationScoreFromStats(p: PunctuationStats, total: number, active: PunctuationActive): number {
  if (total === 0) return 100;
  const ell = active.ellipses ? p.ellipses : 0;
  const ex = active.exclamations ? p.exclamations : 0;
  const mx = active.multiExclamations ? p.multiExclamations : 0;
  const it = active.italicWords ? p.italicWords : 0;
  const raw = ell + mx * 2 + ex * 0.5 + it * 0.25;
  const density = raw / total;
  return rangeScore(density, 0.001, 0.01);
}

export function buildReport(
  scope: AnalysisScope,
  scenes: Scene[],
  chapters: Chapter[],
  onProgress?: ReportProgress,
): ReportResult {
  onProgress?.('resolve', 0);
  const resolved = resolveScope(scope, scenes, chapters);
  const html = resolvedScopeHtml(scope, scenes, chapters);
  const total = totalWordCount(resolved.pieces);
  const joinedText = resolved.pieces.map((p) => p.text).join('\n\n');

  onProgress?.('repetitions', 0.10);
  const repAnalysis = detectRepetitions(resolved.pieces);
  const repetitions = repAnalysis.items;
  onProgress?.('ngrams', 0.25);
  const ngramAnalysis = detectNgrams(resolved.pieces);
  const ngrams = ngramAnalysis.items;
  onProgress?.('adverbs', 0.40);
  const adverbs = detectAdverbs(resolved.pieces);
  onProgress?.('dull-verbs', 0.55);
  const dullVerbs = detectDullVerbs(resolved.pieces);
  onProgress?.('sentences', 0.70);
  const sentences = analyzeSentences(resolved.pieces);
  onProgress?.('lexical', 0.82);
  const lexical = analyzeLexical(resolved.pieces);
  onProgress?.('punctuation', 0.92);
  const punctuation = analyzePunctuation(joinedText, html);
  onProgress?.('finalize', 0.97);

  // Densités rapportées au total de mots (pour les détails affichés)
  const repHits = repetitions.reduce((s, r) => s + r.count, 0);
  const advCount = adverbs.reduce((s, a) => s + a.count, 0);
  const advDensity = total > 0 ? advCount / total : 0;
  const dullCount = dullVerbs.reduce((s, v) => s + v.count, 0);
  const dullDensity = total > 0 ? dullCount / total : 0;

  const scores: ScoreItem[] = [];

  // Répétitions : score basé sur `maxBurst` (concentration max globale).
  // Re-scoring côté UI via `repetitionScoreFromItems` qui scale par le ratio
  // d'occurrences conservées quand l'utilisateur désactive des items.
  scores.push({
    key: 'repetitions',
    label: 'Répétitions',
    score: repetitionScoreFromItems(repetitions, repetitions, repAnalysis.maxBurst, repAnalysis.windowSize, total),
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

  // Tics de langage : densité = nb d'occurrences hors-1ère / total mots
  // Idéal 1 %, gênant ≥ 4 %
  const ngramDensity = total > 0 ? ngramAnalysis.totalRepeats / total : 0;
  scores.push({
    key: 'ngrams',
    label: 'Tics de langage',
    score: ngramScoreFromItems(ngrams, total),
    detail: ngrams.length === 0
      ? `Aucune tournure répétée détectée sur ${total.toLocaleString('fr-FR')} mots.`
      : `${ngrams.length} tournure${ngrams.length > 1 ? 's' : ''} récurrente${ngrams.length > 1 ? 's' : ''}, ${ngramAnalysis.totalRepeats} répétition${ngramAnalysis.totalRepeats > 1 ? 's' : ''} au total (${(ngramDensity * 100).toFixed(1)} %).`,
  });

  // Ponctuation : densité cumulée (ellipses + multi-! + italiques) / mots.
  // Les exclamations simples comptent à demi (moins gênant qu'une "!!").
  // Idéal ≤ 0.1 %, gênant ≥ 1 %.
  scores.push({
    key: 'punctuation',
    label: 'Ponctuation',
    score: punctuationScoreFromStats(punctuation, total, {
      ellipses: true, exclamations: true, multiExclamations: true, italicWords: true,
    }),
    detail: total === 0
      ? 'Aucun texte à analyser.'
      : `${punctuation.ellipses} suspension${punctuation.ellipses > 1 ? 's' : ''}, ${punctuation.exclamations + punctuation.multiExclamations} exclamation${punctuation.exclamations + punctuation.multiExclamations > 1 ? 's' : ''} (dont ${punctuation.multiExclamations} multiple${punctuation.multiExclamations > 1 ? 's' : ''}), ${punctuation.italicWords} mot${punctuation.italicWords > 1 ? 's' : ''} en italique.`,
  });

  // Score global : moyenne de tous les scores. Les items désactivés par
  // l'utilisateur (réglage par-livre) sont appliqués côté UI via les
  // helpers exportés (recompute des scores filtrés sans relancer l'analyse).
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
    repetitionMaxBurst: repAnalysis.maxBurst,
    repetitionWindowSize: repAnalysis.windowSize,
    adverbs,
    dullVerbs,
    ngrams,
    sentences,
    lexical,
    punctuation,
  };
}
