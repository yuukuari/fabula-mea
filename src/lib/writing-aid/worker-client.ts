/**
 * Client du worker writing-aid : singleton + API Promise pour les composants UI.
 * Le worker est lazy : créé à la première analyse, recyclé ensuite.
 *
 * Chaque requête est taguée avec un `requestId` unique pour éviter qu'un
 * `done` en réponse à une requête antérieure ne soit consommé par une promesse
 * plus récente (cas typique : deux clics rapprochés sur ScanText).
 */
import type { Scene, Chapter } from '@/types';
import type { AnalysisScope, RepetitionAnalysis, ReportResult } from './types';
import type { ReportStage } from './report';

export type AnyStage = ReportStage | 'detect';
export type ProgressHandler = (stage: AnyStage, ratio: number) => void;

let workerInstance: Worker | null = null;
let nextRequestId = 1;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../../workers/writing-aid-worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return workerInstance;
}

export function runReport(
  scope: AnalysisScope,
  scenes: Scene[],
  chapters: Chapter[],
  onProgress?: ProgressHandler,
): Promise<ReportResult> {
  const requestId = nextRequestId++;
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.requestId !== requestId) return;
      if (msg.type === 'progress') {
        onProgress?.(msg.stage, msg.ratio);
      } else if (msg.type === 'done-report') {
        cleanup();
        resolve(msg.report);
      }
    };
    const onError = (err: ErrorEvent) => {
      cleanup();
      reject(err.error ?? new Error('Worker error'));
    };
    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ task: 'report', requestId, scope, scenes, chapters });
  });
}

export function runRepetitions(
  scope: AnalysisScope,
  scenes: Scene[],
  chapters: Chapter[],
  onProgress?: ProgressHandler,
): Promise<RepetitionAnalysis> {
  const requestId = nextRequestId++;
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.requestId !== requestId) return;
      if (msg.type === 'progress') {
        onProgress?.(msg.stage, msg.ratio);
      } else if (msg.type === 'done-repetitions') {
        cleanup();
        resolve(msg.analysis);
      }
    };
    const onError = (err: ErrorEvent) => {
      cleanup();
      reject(err.error ?? new Error('Worker error'));
    };
    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ task: 'repetitions', requestId, scope, scenes, chapters });
  });
}
