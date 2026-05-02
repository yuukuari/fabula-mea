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
  const repetitions = detectRepetitions(resolved.pieces);
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
  const repDensity = total > 0 ? repHits / total : 0;
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
    detail: `${repetitions.length} mots répétés (${repHits} occurrences sur ${total} mots).`,
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
