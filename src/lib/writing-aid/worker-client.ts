/**
 * Client du worker writing-aid : singleton + API Promise pour les composants UI.
 * Le worker est lazy : créé à la première analyse, recyclé ensuite.
 */
import type { Scene, Chapter } from '@/types';
import type { AnalysisScope, RepetitionItem, ReportResult } from './types';
import type { ReportStage } from './report';

export type AnyStage = ReportStage | 'detect';
export type ProgressHandler = (stage: AnyStage, ratio: number) => void;

let workerInstance: Worker | null = null;

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
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
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
    w.postMessage({ task: 'report', scope, scenes, chapters });
  });
}

export function runRepetitions(
  scope: AnalysisScope,
  scenes: Scene[],
  chapters: Chapter[],
  onProgress?: ProgressHandler,
): Promise<RepetitionItem[]> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.(msg.stage, msg.ratio);
      } else if (msg.type === 'done-repetitions') {
        cleanup();
        resolve(msg.items);
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
    w.postMessage({ task: 'repetitions', scope, scenes, chapters });
  });
}
