import { differenceInDays, eachDayOfInterval, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import type { Scene, ProjectGoals, ExcludedPeriod } from '@/types';

export function getSceneProgress(scene: Scene): number {
  if (scene.targetWordCount <= 0) return 1;
  return Math.min(scene.currentWordCount / scene.targetWordCount, 1);
}

export function getOverallProgress(scenes: Scene[]): number {
  if (scenes.length === 0) return 0;
  const totalProgress = scenes.reduce((sum, s) => sum + getSceneProgress(s), 0);
  return totalProgress / scenes.length;
}

export function getIncompleteScenesCount(scenes: Scene[]): number {
  return scenes.filter(s => getSceneProgress(s) < 1).length;
}

export function getCompletedScenesCount(scenes: Scene[]): number {
  return scenes.filter(s => getSceneProgress(s) >= 1).length;
}

export function countExcludedDays(
  excludedPeriods: ExcludedPeriod[],
  fromDate: Date,
  toDate: Date
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

export function getScenesPerDay(scenes: Scene[], goals: ProjectGoals): number {
  const workingDays = getWorkingDaysRemaining(goals);
  if (workingDays <= 0) return 0;

  const incomplete = getIncompleteScenesCount(scenes);
  return incomplete / workingDays;
}

export function getWordsPerDay(scenes: Scene[], goals: ProjectGoals): number {
  const scenesDay = getScenesPerDay(scenes, goals);
  return Math.ceil(scenesDay * goals.defaultWordsPerScene);
}

export function getDaysUntilDeadline(goals: ProjectGoals): number {
  if (!goals.targetEndDate) return 0;
  return differenceInDays(parseISO(goals.targetEndDate), new Date());
}
