import { tiptapHtmlToPlainText } from '@/lib/utils';
import type { Scene, Chapter } from '@/types';
import type { AnalysisScope, ResolvedScope, ScenePiece } from './types';

/** Récupère le HTML brut concaténé du scope (pour analyses qui ont besoin
 *  de connaître le formatage, ex. italiques pour la ponctuation). */
export function resolvedScopeHtml(scope: AnalysisScope, scenes: Scene[], chapters: Chapter[]): string {
  if (scope.kind === 'scene') {
    const sc = scenes.find((s) => s.id === scope.sceneId);
    return sc?.content ?? '';
  }
  if (scope.kind === 'chapter') {
    const ch = chapters.find((c) => c.id === scope.chapterId);
    if (!ch) return '';
    return (ch.sceneIds ?? [])
      .map((id) => scenes.find((s) => s.id === id)?.content ?? '')
      .join('\n');
  }
  // book
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);
  const out: string[] = [];
  for (const c of sortedChapters) {
    for (const id of c.sceneIds ?? []) {
      const s = scenes.find((sc) => sc.id === id);
      if (s) out.push(s.content ?? '');
    }
  }
  return out.join('\n');
}

export function resolveScope(
  scope: AnalysisScope,
  scenes: Scene[],
  chapters: Chapter[],
): ResolvedScope {
  if (scope.kind === 'scene') {
    const scene = scenes.find((s) => s.id === scope.sceneId);
    if (!scene) return { pieces: [], scenes: [] };
    return {
      pieces: [{ sceneId: scene.id, chapterId: scene.chapterId, text: tiptapHtmlToPlainText(scene.content ?? '') }],
      scenes: [scene],
    };
  }
  if (scope.kind === 'chapter') {
    const chapter = chapters.find((c) => c.id === scope.chapterId);
    if (!chapter) return { pieces: [], scenes: [] };
    const chScenes = (chapter.sceneIds ?? [])
      .map((id) => scenes.find((s) => s.id === id))
      .filter((s): s is Scene => !!s);
    return {
      pieces: chScenes.map((s) => ({ sceneId: s.id, chapterId: s.chapterId, text: tiptapHtmlToPlainText(s.content ?? '') })),
      scenes: chScenes,
      chapter,
    };
  }
  // book
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);
  const ordered: Scene[] = [];
  for (const c of sortedChapters) {
    for (const id of c.sceneIds ?? []) {
      const s = scenes.find((sc) => sc.id === id);
      if (s) ordered.push(s);
    }
  }
  return {
    pieces: ordered.map((s) => ({ sceneId: s.id, chapterId: s.chapterId, text: tiptapHtmlToPlainText(s.content ?? '') })),
    scenes: ordered,
  };
}

export function joinedText(pieces: ScenePiece[]): string {
  return pieces.map((p) => p.text).join('\n\n');
}

export function totalWordCount(pieces: ScenePiece[]): number {
  let n = 0;
  for (const p of pieces) {
    if (!p.text) continue;
    const matches = p.text.match(/\p{L}+/gu);
    if (matches) n += matches.length;
  }
  return n;
}
