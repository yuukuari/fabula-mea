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
  hits: WordHit[];
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
  adverbs: AdverbItem[];
  dullVerbs: DullVerbItem[];
  sentences: SentenceAnalysis;
  lexical: LexicalAnalysis;
}

export interface ResolvedScope {
  pieces: ScenePiece[];
  scenes: Scene[];
  chapter?: Chapter;
}
