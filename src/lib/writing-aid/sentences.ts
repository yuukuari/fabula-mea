import type { ScenePiece, SentenceAnalysis, SentenceStat } from './types';

const LONG_THRESHOLD = 30;

export function analyzeSentences(pieces: ScenePiece[]): SentenceAnalysis {
  const stats: SentenceStat[] = [];

  for (const piece of pieces) {
    if (!piece.text) continue;
    // Coupe sur . ! ? … en gardant l'offset de chaque phrase.
    const re = /[^.!?…]+[.!?…]+|[^.!?…]+$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(piece.text)) !== null) {
      const text = m[0].trim();
      if (!text) continue;
      const words = text.match(/\p{L}+/gu);
      if (!words || words.length < 3) continue;
      stats.push({
        text,
        wordCount: words.length,
        sceneId: piece.sceneId,
        chapterId: piece.chapterId,
        offset: m.index,
      });
    }
  }

  if (stats.length === 0) {
    return { count: 0, averageWords: 0, longestWords: 0, longest: [], longRatio: 0 };
  }

  const sum = stats.reduce((s, st) => s + st.wordCount, 0);
  const avg = sum / stats.length;
  const longest = [...stats].sort((a, b) => b.wordCount - a.wordCount).slice(0, 10);
  const longCount = stats.filter((s) => s.wordCount > LONG_THRESHOLD).length;

  return {
    count: stats.length,
    averageWords: Math.round(avg * 10) / 10,
    longestWords: longest[0]?.wordCount ?? 0,
    longest,
    longRatio: longCount / stats.length,
  };
}
