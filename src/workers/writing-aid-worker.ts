/// <reference lib="webworker" />
/**
 * Web Worker pour l'analyse Aide à l'écriture.
 * Tourne dans un thread séparé : zéro freeze de l'UI sur les longs livres.
 *
 * Tâches supportées :
 *  - 'report'      → buildReport (rapport complet avec scores)
 *  - 'repetitions' → detectRepetitions seul (outil libre)
 *
 * Émet des messages 'progress' (stage, ratio) puis un 'done', tous étiquetés
 * avec le `requestId` reçu pour permettre au client de filtrer ses propres
 * réponses (cf. worker-client.ts).
 */
import { buildReport, type ReportStage } from '@/lib/writing-aid/report';
import { resolveScope } from '@/lib/writing-aid/manuscript-text';
import { detectRepetitions } from '@/lib/writing-aid/repetitions';
import { detectNgrams } from '@/lib/writing-aid/ngrams';
import type { AnalysisScope, ReportResult, RepetitionAnalysis, NgramAnalysis } from '@/lib/writing-aid/types';
import type { Scene, Chapter } from '@/types';

interface ReportRequest {
  task: 'report';
  requestId: number;
  scope: AnalysisScope;
  scenes: Scene[];
  chapters: Chapter[];
}
interface RepetitionsRequest {
  task: 'repetitions';
  requestId: number;
  scope: AnalysisScope;
  scenes: Scene[];
  chapters: Chapter[];
}
interface NgramsRequest {
  task: 'ngrams';
  requestId: number;
  scope: AnalysisScope;
  scenes: Scene[];
  chapters: Chapter[];
}
type Request = ReportRequest | RepetitionsRequest | NgramsRequest;

export type WorkerMessage =
  | { type: 'progress'; requestId: number; stage: ReportStage | 'detect'; ratio: number }
  | { type: 'done-report'; requestId: number; report: ReportResult }
  | { type: 'done-repetitions'; requestId: number; analysis: RepetitionAnalysis }
  | { type: 'done-ngrams'; requestId: number; analysis: NgramAnalysis };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (e: MessageEvent<Request>) => {
  const req = e.data;
  const requestId = req.requestId;
  if (req.task === 'report') {
    const report = buildReport(req.scope, req.scenes, req.chapters, (stage, ratio) => {
      ctx.postMessage({ type: 'progress', requestId, stage, ratio } satisfies WorkerMessage);
    });
    ctx.postMessage({ type: 'done-report', requestId, report } satisfies WorkerMessage);
  } else if (req.task === 'repetitions') {
    ctx.postMessage({ type: 'progress', requestId, stage: 'detect', ratio: 0.1 } satisfies WorkerMessage);
    const resolved = resolveScope(req.scope, req.scenes, req.chapters);
    ctx.postMessage({ type: 'progress', requestId, stage: 'detect', ratio: 0.5 } satisfies WorkerMessage);
    const analysis = detectRepetitions(resolved.pieces);
    ctx.postMessage({ type: 'done-repetitions', requestId, analysis } satisfies WorkerMessage);
  } else if (req.task === 'ngrams') {
    ctx.postMessage({ type: 'progress', requestId, stage: 'detect', ratio: 0.1 } satisfies WorkerMessage);
    const resolved = resolveScope(req.scope, req.scenes, req.chapters);
    ctx.postMessage({ type: 'progress', requestId, stage: 'detect', ratio: 0.5 } satisfies WorkerMessage);
    const analysis = detectNgrams(resolved.pieces);
    ctx.postMessage({ type: 'done-ngrams', requestId, analysis } satisfies WorkerMessage);
  }
});
