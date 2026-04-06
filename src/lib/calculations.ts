import { differenceInDays, eachDayOfInterval, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import type { Scene, ProjectGoals, ExcludedPeriod, CountUnit } from '@/types';
import { WORDS_TO_CHARS_RATIO } from '@/lib/utils';

// ─── Helpers ───

export function isSceneComplete(scene: Scene): boolean {
  return scene.status === 'revision' || scene.status === 'complete';
}

export function isDateExcluded(date: Date, excludedPeriods: ExcludedPeriod[]): boolean {
  const day = startOfDay(date);
  for (const period of excludedPeriods) {
    const periodStart = startOfDay(parseISO(period.startDate));
    const periodEnd = startOfDay(parseISO(period.endDate));
    if (isWithinInterval(day, { start: periodStart, end: periodEnd })) {
      return true;
    }
  }
  return false;
}

export function isTodayExcluded(goals: ProjectGoals): boolean {
  return isDateExcluded(new Date(), goals.excludedPeriods);
}

// ─── Scene Target ───

/**
 * Calcule l'objectif de mots/signes pour une scène donnée.
 * Retourne null si aucun objectif chiffré n'est défini (mode 'none').
 */
export function getSceneTarget(
  scene: Scene,
  allScenes: Scene[],
  goals: ProjectGoals,
): number | null {
  if (goals.mode === 'total' && goals.targetTotalCount && goals.targetTotalCount > 0) {
    if (isSceneComplete(scene)) return scene.currentWordCount;
    const completedSum = allScenes
      .filter((s) => isSceneComplete(s))
      .reduce((sum, s) => sum + s.currentWordCount, 0);
    const incompleteCount = allScenes.filter((s) => !isSceneComplete(s)).length;
    if (incompleteCount === 0) return 0;
    const remaining = Math.max(0, goals.targetTotalCount - completedSum);
    return Math.ceil(remaining / incompleteCount);
  }

  if (goals.mode === 'perScene' && goals.targetCountPerScene && goals.targetCountPerScene > 0) {
    if (isSceneComplete(scene)) return scene.currentWordCount;
    return goals.targetCountPerScene;
  }

  return null;
}

// ─── Scene Progress ───

/**
 * Calcule la progression d'une scène (0-1).
 */
export function getSceneProgress(
  scene: Scene,
  allScenes: Scene[],
  goals: ProjectGoals,
): number {
  if (isSceneComplete(scene)) return 1;

  if (goals.mode === 'total') {
    const target = getSceneTarget(scene, allScenes, goals);
    if (!target || target <= 0) return 0;
    return Math.min(1, scene.currentWordCount / target);
  }

  if (goals.mode === 'perScene') {
    if (!goals.targetCountPerScene || goals.targetCountPerScene <= 0) return 0;
    return Math.min(1, scene.currentWordCount / goals.targetCountPerScene);
  }

  // mode 'none'
  return 0;
}

// ─── Overall Progress ───

/**
 * Calcule la progression globale du livre (0-1).
 */
export function getOverallProgress(scenes: Scene[], goals: ProjectGoals): number {
  if (scenes.length === 0) return 0;

  if (goals.mode === 'total' && goals.targetTotalCount && goals.targetTotalCount > 0) {
    const totalWritten = scenes.reduce((sum, s) => sum + s.currentWordCount, 0);
    return Math.min(1, totalWritten / goals.targetTotalCount);
  }

  if (goals.mode === 'perScene') {
    const totalProgress = scenes.reduce(
      (sum, s) => sum + getSceneProgress(s, scenes, goals),
      0,
    );
    return totalProgress / scenes.length;
  }

  // mode 'none'
  const completed = scenes.filter((s) => isSceneComplete(s)).length;
  return completed / scenes.length;
}

// ─── Completed / Incomplete Scenes ───

export function getCompletedScenesCount(scenes: Scene[]): number {
  return scenes.filter((s) => isSceneComplete(s)).length;
}

export function getIncompleteScenesCount(scenes: Scene[]): number {
  return scenes.filter((s) => !isSceneComplete(s)).length;
}

// ─── Excluded Days & Working Days ───

export function countExcludedDays(
  excludedPeriods: ExcludedPeriod[],
  fromDate: Date,
  toDate: Date,
): number {
  if (fromDate >= toDate) return 0;

  const allDays = eachDayOfInterval({ start: fromDate, end: toDate });
  let excludedCount = 0;

  for (const day of allDays) {
    const dayStart = startOfDay(day);
    for (const period of excludedPeriods) {
      const periodStart = startOfDay(parseISO(period.startDate));
      const periodEnd = startOfDay(parseISO(period.endDate));
      if (isWithinInterval(dayStart, { start: periodStart, end: periodEnd })) {
        excludedCount++;
        break;
      }
    }
  }

  return excludedCount;
}

export function getWorkingDaysRemaining(goals: ProjectGoals): number {
  if (!goals.targetEndDate) return 0;

  const today = startOfDay(new Date());
  const endDate = startOfDay(parseISO(goals.targetEndDate));

  if (today >= endDate) return 0;

  const totalDays = differenceInDays(endDate, today);
  const excludedDays = countExcludedDays(goals.excludedPeriods, today, endDate);

  return Math.max(totalDays - excludedDays, 0);
}

export function getDaysUntilDeadline(goals: ProjectGoals): number {
  if (!goals.targetEndDate) return 0;
  return differenceInDays(parseISO(goals.targetEndDate), new Date());
}

// ─── Daily Goal ───

/**
 * Calcule l'objectif journalier en mots/signes.
 * Retourne null si non applicable (objectif temps, désactivé, jour exclu, etc.).
 *
 * Logique :
 * - objectiveEnabled = false → null
 * - objectiveType = 'time' → null (pas d'objectif en mots)
 * - objectiveType = 'wordCount' :
 *   - mode 'total' ou 'perScene' + targetEndDate → calculé auto (remaining / workingDays)
 *   - mode 'total' ou 'perScene' sans targetEndDate → manualDailyGoal
 *   - mode 'none' → manualDailyGoal
 */
export function getDailyGoal(scenes: Scene[], goals: ProjectGoals): number | null {
  if (!goals.objectiveEnabled) return null;
  if (goals.objectiveType === 'time') return null;
  if (isTodayExcluded(goals)) return null;

  const hasBookTarget = (goals.mode === 'total' && goals.targetTotalCount && goals.targetTotalCount > 0)
    || (goals.mode === 'perScene' && goals.targetCountPerScene && goals.targetCountPerScene > 0);

  // Auto-calculated when we have a book-level target AND an end date
  if (hasBookTarget && goals.targetEndDate) {
    const workingDays = getWorkingDaysRemaining(goals);
    if (workingDays <= 0) return null;

    if (goals.mode === 'total' && goals.targetTotalCount && goals.targetTotalCount > 0) {
      const totalWritten = scenes.reduce((sum, s) => sum + s.currentWordCount, 0);
      const remaining = Math.max(0, goals.targetTotalCount - totalWritten);
      return Math.ceil(remaining / workingDays);
    }

    if (goals.mode === 'perScene' && goals.targetCountPerScene && goals.targetCountPerScene > 0) {
      const remainingUnits = scenes
        .filter((s) => !isSceneComplete(s))
        .reduce((sum, s) => sum + Math.max(0, goals.targetCountPerScene! - s.currentWordCount), 0);
      return Math.ceil(remainingUnits / workingDays);
    }
  }

  // Manual daily goal (mode 'none' or no end date)
  return goals.manualDailyGoal ?? null;
}

// ─── Book Type Estimation ───

export type BookType = 'micro_nouvelle' | 'nouvelle' | 'novella' | 'roman_court' | 'roman' | 'long_roman' | 'tres_long_roman';

const WORDS_PER_PAGE = 250;

/** Estimate page count. If unit is 'characters', converts to words first using the standard ratio. */
export function getPageEstimate(count: number, unit: CountUnit = 'words'): number {
  const words = unit === 'characters' ? Math.round(count / WORDS_TO_CHARS_RATIO) : count;
  return Math.ceil(words / WORDS_PER_PAGE);
}

/**
 * Book type thresholds (source: monde-fantasy.com)
 * Words / Characters (spaces incl.)
 * < 1 000 / < 6 000              → Micro-nouvelle
 * 1 000 – 15 000 / 6 000 – 90 000   → Nouvelle
 * 15 000 – 30 000 / 90 000 – 180 000 → Novella
 * 30 000 – 50 000 / 180 000 – 300 000 → Roman court
 * 50 000 – 80 000 / 300 000 – 480 000 → Roman
 * 80 000 – 110 000 / 480 000 – 660 000 → Long roman
 * > 110 000 / > 660 000            → Très long roman
 */
const BOOK_TYPE_THRESHOLDS: { type: BookType; label: string; maxWords: number; maxChars: number }[] = [
  { type: 'micro_nouvelle', label: 'Micro-nouvelle', maxWords: 1_000, maxChars: 6_000 },
  { type: 'nouvelle', label: 'Nouvelle', maxWords: 15_000, maxChars: 90_000 },
  { type: 'novella', label: 'Novella', maxWords: 30_000, maxChars: 180_000 },
  { type: 'roman_court', label: 'Roman court', maxWords: 50_000, maxChars: 300_000 },
  { type: 'roman', label: 'Roman', maxWords: 80_000, maxChars: 480_000 },
  { type: 'long_roman', label: 'Long roman', maxWords: 110_000, maxChars: 660_000 },
];

export function getBookType(count: number, unit: CountUnit = 'words'): { type: BookType; label: string; pages: number } {
  const pages = getPageEstimate(count, unit);
  for (const t of BOOK_TYPE_THRESHOLDS) {
    const threshold = unit === 'characters' ? t.maxChars : t.maxWords;
    if (count <= threshold) return { type: t.type, label: t.label, pages };
  }
  return { type: 'tres_long_roman', label: 'Très long roman', pages };
}

/** Exported for UI (BookTypeScale) */
export { BOOK_TYPE_THRESHOLDS };

/**
 * Estime le nombre total de mots et par scène à partir des scènes déjà écrites.
 * Utile en mode "je ne sais pas".
 */
export function estimateFromScenes(scenes: Scene[]): {
  estimatedTotal: number;
  estimatedPerScene: number;
  completedCount: number;
} {
  const completedScenes = scenes.filter((s) => isSceneComplete(s));
  if (completedScenes.length === 0) {
    // Fallback: use all scenes with content
    const withContent = scenes.filter((s) => s.currentWordCount > 0);
    if (withContent.length === 0) return { estimatedTotal: 0, estimatedPerScene: 0, completedCount: 0 };
    const avgWords = withContent.reduce((sum, s) => sum + s.currentWordCount, 0) / withContent.length;
    return {
      estimatedPerScene: Math.round(avgWords),
      estimatedTotal: Math.round(avgWords * scenes.length),
      completedCount: 0,
    };
  }
  const avgWords = completedScenes.reduce((sum, s) => sum + s.currentWordCount, 0) / completedScenes.length;
  return {
    estimatedPerScene: Math.round(avgWords),
    estimatedTotal: Math.round(avgWords * scenes.length),
    completedCount: completedScenes.length,
  };
}

// ─── Today Progress (localStorage snapshot) ───

/**
 * Get today's written count by comparing current total to a stored snapshot from the start of today.
 * Uses localStorage to track the "start of day" total.
 */
export function getTodayProgress(
  bookId: string,
  currentTotal: number,
): { todayCount: number; startOfDayTotal: number } {
  const todayKey = `emlb-daily-snapshot:${bookId}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const stored = localStorage.getItem(todayKey);
  let startOfDayTotal = currentTotal;

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date === todayStr) {
        startOfDayTotal = parsed.total;
      } else {
        // New day — snapshot the current total
        localStorage.setItem(todayKey, JSON.stringify({ date: todayStr, total: currentTotal }));
        startOfDayTotal = currentTotal;
      }
    } catch {
      localStorage.setItem(todayKey, JSON.stringify({ date: todayStr, total: currentTotal }));
    }
  } else {
    // First time — snapshot now
    localStorage.setItem(todayKey, JSON.stringify({ date: todayStr, total: currentTotal }));
  }

  return {
    todayCount: Math.max(0, currentTotal - startOfDayTotal),
    startOfDayTotal,
  };
}
