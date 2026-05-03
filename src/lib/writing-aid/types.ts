import type { Scene, Chapter } from '@/types';

export type AnalysisScope =
  | { kind: 'scene'; sceneId: string }
  | { kind: 'chapter'; chapterId: string }
  | { kind: 'book' };

export interface ScenePiece {
  sceneId: string;
  chapterId: string;
  text: string;
}

/** Position d'un mot ou d'un fragment dans le manuscrit. */
export interface WordHit {
  sceneId: string;
  chapterId: string;
  /** Offset (en caractères) dans le texte plein de la scène. */
  offset: number;
  word: string;
}

export interface RepetitionItem {
  word: string;
  count: number;
  /** Nombre maximal d'occurrences dans une fenêtre glissante (densité locale par mot). */
  maxWindowCount: number;
  /** Taille de la fenêtre utilisée pour calculer maxWindowCount (en mots). */
  windowSize: number;
  hits: WordHit[];
}

/** Résultat global de l'analyse de répétitions, avec densité maximale globale. */
export interface RepetitionAnalysis {
  items: RepetitionItem[];
  /** Densité maximale, en occurrences répétées (tous mots confondus) dans la
   *  fenêtre la plus dense du manuscrit. Utilisé pour le score : c'est ce qui
   *  capture la sensation de « paragraphe saturé de répétitions ». */
  maxBurst: number;
  /** Taille de la fenêtre, en mots. */
  windowSize: number;
}

export interface AdverbItem {
  word: string;
  count: number;
  hits: WordHit[];
}

export interface DullVerbItem {
  word: string;
  count: number;
  hits: WordHit[];
}

/** Position d'un n-gramme (séquence de mots) dans le manuscrit. */
export interface PhraseHit {
  sceneId: string;
  chapterId: string;
  /** Texte exact du n-gramme tel qu'il apparaît (premier exemple rencontré). */
  text: string;
}

export interface NgramItem {
  /** Forme normalisée (lowercase + accents NFD strippés), utilisée comme clé. */
  key: string;
  /** Texte affichable (forme du premier hit). */
  text: string;
  /** Taille du n-gramme (2 ou 3). */
  size: number;
  count: number;
  /** Densité locale max (occurrences dans la fenêtre la plus dense). */
  maxWindowCount: number;
  windowSize: number;
  hits: PhraseHit[];
}

export interface NgramAnalysis {
  items: NgramItem[];
  /** Total des occurrences toutes confondues, hors 1ère apparition de chaque n-gramme. */
  totalRepeats: number;
  windowSize: number;
}

/** Stats de ponctuation, exposées dans le rapport (section désactivable par livre). */
export interface PunctuationStats {
  /** Nombre de "…" ou "...". */
  ellipses: number;
  /** Nombre de "!" simples. */
  exclamations: number;
  /** Nombre de "!!" ou plus (souvent l'abus le plus marquant). */
  multiExclamations: number;
  /** Mots en italique (depuis le HTML : <em>/<i>). */
  italicWords: number;
  /** Mots totaux du manuscrit (pour le calcul des densités). */
  totalWords: number;
}

export interface SentenceStat {
  text: string;
  wordCount: number;
  sceneId: string;
  chapterId: string;
  offset: number;
}

export interface SentenceAnalysis {
  count: number;
  averageWords: number;
  longestWords: number;
  longest: SentenceStat[];
  longRatio: number;
}

export interface LexicalAnalysis {
  totalWords: number;
  uniqueWords: number;
  ratio: number;
}

export interface ScoreItem {
  key: string;
  label: string;
  score: number;
  detail: string;
}

export interface ReportResult {
  scope: AnalysisScope;
  totalWords: number;
  generatedAt: string;
  globalScore: number;
  scores: ScoreItem[];
  repetitions: RepetitionItem[];
  /** Concentration maximale globale de répétitions (toutes confondues), pour
   *  recalculer le score Répétitions côté UI quand des items sont désactivés. */
  repetitionMaxBurst: number;
  repetitionWindowSize: number;
  adverbs: AdverbItem[];
  dullVerbs: DullVerbItem[];
  ngrams: NgramItem[];
  sentences: SentenceAnalysis;
  lexical: LexicalAnalysis;
  punctuation: PunctuationStats;
}

export interface ResolvedScope {
  pieces: ScenePiece[];
  scenes: Scene[];
  chapter?: Chapter;
}
