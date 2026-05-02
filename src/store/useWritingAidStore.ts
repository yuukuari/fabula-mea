import { create } from 'zustand';
import type { AnalysisScope, ReportResult } from '@/lib/writing-aid/types';

export type WritingAidTab = 'tools' | 'report';
export type WritingAidTool = 'repetitions' | 'synonyms' | 'antonyms' | 'figures';

export interface AidHighlight {
  /** Mots à surligner, en minuscules normalisées (sans accents). */
  words: string[];
  /** Limite la surbrillance à ces scènes (le scope analysé). */
  sceneIds: string[];
  /** Forces re-renders des extensions TipTap quand on relance la même surbrillance. */
  nonce: number;
}

export interface AidFocusedHit {
  sceneId: string;
  /** Index de l'occurrence dans la scène (0-based, parmi les `words` surlignés). */
  occurrenceIndex: number;
  nonce: number;
}

export interface AidFocusedSentence {
  sceneId: string;
  /** Texte exact de la phrase à chercher dans la scène (recherche brute). */
  text: string;
  nonce: number;
}

interface WritingAidStore {
  tab: WritingAidTab;
  tool: WritingAidTool;
  scope: AnalysisScope;
  /** Dernier rapport généré (pour le tab Analyse). */
  report: ReportResult | null;
  reportLoading: boolean;
  /** Demande différée d'auto-run émise par les icônes contextuelles. */
  pendingAutoRun: { scope: AnalysisScope; nonce: number } | null;
  /** Mots surlignés dans l'éditeur. */
  highlight: AidHighlight | null;
  /** Occurrence actuellement « ciblée » (scroll + style renforcé). */
  focusedHit: AidFocusedHit | null;
  /** Phrase ciblée (mutuellement exclusive avec highlight/focusedHit). */
  focusedSentence: AidFocusedSentence | null;

  setTab: (tab: WritingAidTab) => void;
  setTool: (tool: WritingAidTool) => void;
  setScope: (scope: AnalysisScope) => void;
  setReport: (r: ReportResult | null) => void;
  setReportLoading: (b: boolean) => void;
  /** Programme un auto-run depuis l'extérieur (icônes scène/chapitre). */
  requestAutoRun: (scope: AnalysisScope) => void;
  consumeAutoRun: () => void;
  setHighlight: (h: AidHighlight | null) => void;
  setFocusedHit: (h: AidFocusedHit | null) => void;
  setFocusedSentence: (s: AidFocusedSentence | null) => void;
  clearHighlight: () => void;
}

export const useWritingAidStore = create<WritingAidStore>((set) => ({
  tab: 'tools',
  tool: 'repetitions',
  scope: { kind: 'book' },
  report: null,
  reportLoading: false,
  pendingAutoRun: null,
  highlight: null,
  focusedHit: null,
  focusedSentence: null,

  setTab: (tab) => set({ tab }),
  setTool: (tool) => set({ tool }),
  setScope: (scope) => set({ scope }),
  setReport: (report) => set({ report }),
  setReportLoading: (reportLoading) => set({ reportLoading }),
  requestAutoRun: (scope) => set({
    pendingAutoRun: { scope, nonce: Date.now() },
    scope,
    tab: 'report',
  }),
  consumeAutoRun: () => set({ pendingAutoRun: null }),
  setHighlight: (highlight) => set(highlight
    ? { highlight, focusedSentence: null }
    : { highlight: null }),
  setFocusedHit: (focusedHit) => set({ focusedHit }),
  setFocusedSentence: (focusedSentence) => set(focusedSentence
    ? { focusedSentence, highlight: null, focusedHit: null }
    : { focusedSentence: null }),
  clearHighlight: () => set({ highlight: null, focusedHit: null, focusedSentence: null }),
}));

/** Normalise un mot pour la comparaison (minuscule + accents enlevés). */
export function normalizeWord(w: string): string {
  return w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}
