/// <reference lib="webworker" />
/**
 * Web Worker pour l'analyse Aide à l'écriture.
 * Tourne dans un thread séparé : zéro freeze de l'UI sur les longs livres.
 *
 * Tâches supportées :
 *  - 'report'      → buildReport (rapport complet avec scores)
 *  - 'repetitions' → detectRepetitions seul (outil libre)
 *
 * Émet des messages 'progress' (stage, ratio) puis un 'done'.
 */
import { buildReport, type ReportStage } from '@/lib/writing-aid/report';
import { resolveScope } from '@/lib/writing-aid/manuscript-text';
import { detectRepetitions } from '@/lib/writing-aid/repetitions';
import type { AnalysisScope, ReportResult, RepetitionItem } from '@/lib/writing-aid/types';
import type { Scene, Chapter } from '@/types';

interface ReportRequest {
  task: 'report';
  scope: AnalysisScope;
  scenes: Scene[];
  chapters: Chapter[];
}
interface RepetitionsRequest {
  task: 'repetitions';
  scope: AnalysisScope;
  scenes: Scene[];
  chapters: Chapter[];
}
type Request = ReportRequest | RepetitionsRequest;

export type WorkerMessage =
  | { type: 'progress'; stage: ReportStage | 'detect'; ratio: number }
  | { type: 'done-report'; report: ReportResult }
  | { type: 'done-repetitions'; items: RepetitionItem[] };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (e: MessageEvent<Request>) => {
  const req = e.data;
  if (req.task === 'report') {
    const report = buildReport(req.scope, req.scenes, req.chapters, (stage, ratio) => {
      ctx.postMessage({ type: 'progress', stage, ratio } satisfies WorkerMessage);
    });
    ctx.postMessage({ type: 'done-report', report } satisfies WorkerMessage);
  } else if (req.task === 'repetitions') {
    ctx.postMessage({ type: 'progress', stage: 'detect', ratio: 0.1 } satisfies WorkerMessage);
    const resolved = resolveScope(req.scope, req.scenes, req.chapters);
    ctx.postMessage({ type: 'progress', stage: 'detect', ratio: 0.5 } satisfies WorkerMessage);
    const items = detectRepetitions(resolved.pieces);
    ctx.postMessage({ type: 'done-repetitions', items } satisfies WorkerMessage);
  }
});
