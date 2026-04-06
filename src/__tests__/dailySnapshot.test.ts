import { describe, it, expect } from 'vitest';

/**
 * Tests for the daily snapshot update optimization.
 * When nothing changed, updateDailySnapshot should return
 * the same array reference (no unnecessary re-render).
 */

interface DailySnapshot {
  date: string;
  totalWritten: number;
  writtenToday: number;
  dailyGoal: number;
  progress: number;
  completedScenes: number;
  totalScenes: number;
  writingMinutesToday?: number;
}

// Simplified version of the optimized updateDailySnapshot logic
function updateDailySnapshot(
  existing: DailySnapshot[],
  newSnapshot: DailySnapshot,
): DailySnapshot[] {
  const todayIdx = existing.findIndex((s) => s.date === newSnapshot.date);
  if (todayIdx >= 0) {
    // Preserve writing minutes
    if (existing[todayIdx].writingMinutesToday) {
      newSnapshot.writingMinutesToday = existing[todayIdx].writingMinutesToday;
    }
    const prev = existing[todayIdx];
    if (
      prev.totalWritten === newSnapshot.totalWritten &&
      prev.writtenToday === newSnapshot.writtenToday &&
      prev.dailyGoal === newSnapshot.dailyGoal &&
      prev.progress === newSnapshot.progress &&
      prev.completedScenes === newSnapshot.completedScenes &&
      prev.totalScenes === newSnapshot.totalScenes &&
      prev.writingMinutesToday === newSnapshot.writingMinutesToday
    ) {
      return existing; // Same reference = no re-render
    }
    const snapshots = [...existing];
    snapshots[todayIdx] = newSnapshot;
    return snapshots;
  }
  return [...existing, newSnapshot];
}

describe('updateDailySnapshot', () => {
  const today = new Date().toISOString().split('T')[0];

  it('returns same reference when nothing changed', () => {
    const snapshot: DailySnapshot = {
      date: today,
      totalWritten: 5000,
      writtenToday: 200,
      dailyGoal: 500,
      progress: 0.4,
      completedScenes: 2,
      totalScenes: 5,
    };
    const existing = [snapshot];
    const result = updateDailySnapshot(existing, { ...snapshot });
    expect(result).toBe(existing); // Same reference
  });

  it('returns new array when totalWritten changed', () => {
    const snapshot: DailySnapshot = {
      date: today,
      totalWritten: 5000,
      writtenToday: 200,
      dailyGoal: 500,
      progress: 0.4,
      completedScenes: 2,
      totalScenes: 5,
    };
    const existing = [snapshot];
    const updated = { ...snapshot, totalWritten: 5100 };
    const result = updateDailySnapshot(existing, updated);
    expect(result).not.toBe(existing);
    expect(result[0].totalWritten).toBe(5100);
  });

  it('appends for a new day', () => {
    const yesterday: DailySnapshot = {
      date: '2024-01-01',
      totalWritten: 5000,
      writtenToday: 200,
      dailyGoal: 500,
      progress: 0.4,
      completedScenes: 2,
      totalScenes: 5,
    };
    const todaySnapshot: DailySnapshot = {
      date: today,
      totalWritten: 5200,
      writtenToday: 0,
      dailyGoal: 500,
      progress: 0.4,
      completedScenes: 2,
      totalScenes: 5,
    };
    const existing = [yesterday];
    const result = updateDailySnapshot(existing, todaySnapshot);
    expect(result.length).toBe(2);
    expect(result).not.toBe(existing);
  });

  it('preserves writingMinutesToday from existing snapshot', () => {
    const existing: DailySnapshot[] = [{
      date: today,
      totalWritten: 5000,
      writtenToday: 200,
      dailyGoal: 500,
      progress: 0.4,
      completedScenes: 2,
      totalScenes: 5,
      writingMinutesToday: 30,
    }];
    const newSnapshot: DailySnapshot = {
      date: today,
      totalWritten: 5100,
      writtenToday: 300,
      dailyGoal: 500,
      progress: 0.4,
      completedScenes: 2,
      totalScenes: 5,
    };
    const result = updateDailySnapshot(existing, newSnapshot);
    expect(result[0].writingMinutesToday).toBe(30);
  });
});
