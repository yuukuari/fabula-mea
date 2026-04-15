import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Scene, ProjectGoals, ExcludedPeriod } from '@/types';

// ─── Test helpers ───

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: overrides.id ?? 'scene-1',
    title: '',
    description: '',
    chapterId: 'ch-1',
    orderInChapter: 0,
    characterIds: [],
    targetWordCount: 0,
    currentWordCount: 0,
    status: 'draft',
    tags: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeGoals(overrides: Partial<ProjectGoals> = {}): ProjectGoals {
  return {
    mode: 'none',
    objectiveEnabled: false,
    excludedPeriods: [],
    ...overrides,
  };
}

// ─── isSceneComplete ───

describe('isSceneComplete', () => {
  let isSceneComplete: typeof import('@/lib/calculations').isSceneComplete;

  beforeEach(async () => {
    ({ isSceneComplete } = await import('@/lib/calculations'));
  });

  it('returns true for revision status', () => {
    expect(isSceneComplete(makeScene({ status: 'revision' }))).toBe(true);
  });

  it('returns true for complete status', () => {
    expect(isSceneComplete(makeScene({ status: 'complete' }))).toBe(true);
  });

  it('returns false for draft status', () => {
    expect(isSceneComplete(makeScene({ status: 'draft' }))).toBe(false);
  });

  it('returns false for outline status', () => {
    expect(isSceneComplete(makeScene({ status: 'outline' }))).toBe(false);
  });
});

// ─── isDateExcluded ───

describe('isDateExcluded', () => {
  let isDateExcluded: typeof import('@/lib/calculations').isDateExcluded;

  beforeEach(async () => {
    ({ isDateExcluded } = await import('@/lib/calculations'));
  });

  const periods: ExcludedPeriod[] = [
    { id: 'p1', startDate: '2025-06-01', endDate: '2025-06-15', label: 'Vacances' },
  ];

  it('returns true for a date within the period', () => {
    expect(isDateExcluded(new Date('2025-06-10'), periods)).toBe(true);
  });

  it('returns true on exact start boundary', () => {
    expect(isDateExcluded(new Date('2025-06-01'), periods)).toBe(true);
  });

  it('returns true on exact end boundary', () => {
    expect(isDateExcluded(new Date('2025-06-15'), periods)).toBe(true);
  });

  it('returns false for a date outside the period', () => {
    expect(isDateExcluded(new Date('2025-05-31'), periods)).toBe(false);
    expect(isDateExcluded(new Date('2025-06-16'), periods)).toBe(false);
  });

  it('returns false when no periods defined', () => {
    expect(isDateExcluded(new Date('2025-06-10'), [])).toBe(false);
  });
});

// ─── countExcludedDays ───

describe('countExcludedDays', () => {
  let countExcludedDays: typeof import('@/lib/calculations').countExcludedDays;

  beforeEach(async () => {
    ({ countExcludedDays } = await import('@/lib/calculations'));
  });

  it('returns 0 when no excluded periods', () => {
    expect(countExcludedDays([], new Date('2025-01-01'), new Date('2025-01-31'))).toBe(0);
  });

  it('counts days within a single period', () => {
    const periods: ExcludedPeriod[] = [
      { id: 'p1', startDate: '2025-01-10', endDate: '2025-01-15', label: 'break' },
    ];
    // From Jan 1 to Jan 31 → 6 excluded days (10,11,12,13,14,15)
    expect(countExcludedDays(periods, new Date('2025-01-01'), new Date('2025-01-31'))).toBe(6);
  });

  it('counts only overlapping days when period exceeds range', () => {
    const periods: ExcludedPeriod[] = [
      { id: 'p1', startDate: '2024-12-20', endDate: '2025-01-05', label: 'holidays' },
    ];
    // Range Jan 1–10, period starts before → 5 excluded days (1,2,3,4,5)
    expect(countExcludedDays(periods, new Date('2025-01-01'), new Date('2025-01-10'))).toBe(5);
  });

  it('counts multiple periods without double-counting', () => {
    const periods: ExcludedPeriod[] = [
      { id: 'p1', startDate: '2025-01-02', endDate: '2025-01-03', label: 'a' },
      { id: 'p2', startDate: '2025-01-05', endDate: '2025-01-06', label: 'b' },
    ];
    expect(countExcludedDays(periods, new Date('2025-01-01'), new Date('2025-01-10'))).toBe(4);
  });

  it('returns 0 when fromDate >= toDate', () => {
    const periods: ExcludedPeriod[] = [
      { id: 'p1', startDate: '2025-01-01', endDate: '2025-01-31', label: 'x' },
    ];
    expect(countExcludedDays(periods, new Date('2025-01-15'), new Date('2025-01-15'))).toBe(0);
    expect(countExcludedDays(periods, new Date('2025-01-20'), new Date('2025-01-10'))).toBe(0);
  });

  it('returns 0 when period is completely outside the range', () => {
    const periods: ExcludedPeriod[] = [
      { id: 'p1', startDate: '2025-03-01', endDate: '2025-03-10', label: 'x' },
    ];
    expect(countExcludedDays(periods, new Date('2025-01-01'), new Date('2025-01-31'))).toBe(0);
  });
});

// ─── getSceneTarget ───

describe('getSceneTarget', () => {
  let getSceneTarget: typeof import('@/lib/calculations').getSceneTarget;

  beforeEach(async () => {
    ({ getSceneTarget } = await import('@/lib/calculations'));
  });

  it('returns null for mode none', () => {
    const scene = makeScene({ currentWordCount: 500 });
    expect(getSceneTarget(scene, [scene], makeGoals({ mode: 'none' }))).toBeNull();
  });

  it('mode total: distributes remaining words across incomplete scenes', () => {
    const complete = makeScene({ id: 's1', status: 'complete', currentWordCount: 3000 });
    const incomplete1 = makeScene({ id: 's2', status: 'draft', currentWordCount: 500 });
    const incomplete2 = makeScene({ id: 's3', status: 'draft', currentWordCount: 200 });
    const scenes = [complete, incomplete1, incomplete2];
    const goals = makeGoals({ mode: 'total', targetTotalCount: 10000 });
    // remaining = 10000 - 3000 = 7000, 2 incomplete → 3500 each
    expect(getSceneTarget(incomplete1, scenes, goals)).toBe(3500);
  });

  it('mode total: returns currentWordCount for complete scene', () => {
    const scene = makeScene({ status: 'complete', currentWordCount: 4200 });
    const goals = makeGoals({ mode: 'total', targetTotalCount: 10000 });
    expect(getSceneTarget(scene, [scene], goals)).toBe(4200);
  });

  it('mode perScene: returns targetCountPerScene', () => {
    const scene = makeScene({ status: 'draft', currentWordCount: 200 });
    const goals = makeGoals({ mode: 'perScene', targetCountPerScene: 2000 });
    expect(getSceneTarget(scene, [scene], goals)).toBe(2000);
  });

  it('mode perScene: returns currentWordCount for complete scene', () => {
    const scene = makeScene({ status: 'revision', currentWordCount: 1800 });
    const goals = makeGoals({ mode: 'perScene', targetCountPerScene: 2000 });
    expect(getSceneTarget(scene, [scene], goals)).toBe(1800);
  });
});

// ─── getSceneProgress ───

describe('getSceneProgress', () => {
  let getSceneProgress: typeof import('@/lib/calculations').getSceneProgress;

  beforeEach(async () => {
    ({ getSceneProgress } = await import('@/lib/calculations'));
  });

  it('returns 1 for complete scene regardless of mode', () => {
    const scene = makeScene({ status: 'complete', currentWordCount: 500 });
    expect(getSceneProgress(scene, [scene], makeGoals({ mode: 'total', targetTotalCount: 10000 }))).toBe(1);
    expect(getSceneProgress(scene, [scene], makeGoals({ mode: 'perScene', targetCountPerScene: 2000 }))).toBe(1);
    expect(getSceneProgress(scene, [scene], makeGoals({ mode: 'none' }))).toBe(1);
  });

  it('mode total: returns fraction of target', () => {
    const scene = makeScene({ status: 'draft', currentWordCount: 2500 });
    const goals = makeGoals({ mode: 'total', targetTotalCount: 5000 });
    // target = 5000 / 1 incomplete = 5000, progress = 2500/5000 = 0.5
    expect(getSceneProgress(scene, [scene], goals)).toBe(0.5);
  });

  it('mode perScene: returns fraction of per-scene target', () => {
    const scene = makeScene({ status: 'draft', currentWordCount: 750 });
    const goals = makeGoals({ mode: 'perScene', targetCountPerScene: 1500 });
    expect(getSceneProgress(scene, [scene], goals)).toBe(0.5);
  });

  it('mode none: returns 0 for incomplete scene', () => {
    const scene = makeScene({ status: 'draft', currentWordCount: 1000 });
    expect(getSceneProgress(scene, [scene], makeGoals({ mode: 'none' }))).toBe(0);
  });

  it('caps at 1 when over target', () => {
    const scene = makeScene({ status: 'draft', currentWordCount: 6000 });
    const goals = makeGoals({ mode: 'total', targetTotalCount: 5000 });
    expect(getSceneProgress(scene, [scene], goals)).toBe(1);
  });
});

// ─── getOverallProgress ───

describe('getOverallProgress', () => {
  let getOverallProgress: typeof import('@/lib/calculations').getOverallProgress;

  beforeEach(async () => {
    ({ getOverallProgress } = await import('@/lib/calculations'));
  });

  it('returns 0 for empty scenes array', () => {
    expect(getOverallProgress([], makeGoals())).toBe(0);
  });

  it('mode total: sum of word counts / target', () => {
    const scenes = [
      makeScene({ id: 's1', currentWordCount: 3000 }),
      makeScene({ id: 's2', currentWordCount: 2000 }),
    ];
    const goals = makeGoals({ mode: 'total', targetTotalCount: 10000 });
    expect(getOverallProgress(scenes, goals)).toBe(0.5);
  });

  it('mode total: capped at 1', () => {
    const scenes = [makeScene({ currentWordCount: 12000 })];
    const goals = makeGoals({ mode: 'total', targetTotalCount: 10000 });
    expect(getOverallProgress(scenes, goals)).toBe(1);
  });

  it('mode perScene: average of scene progresses', () => {
    const scenes = [
      makeScene({ id: 's1', status: 'complete', currentWordCount: 2000 }),
      makeScene({ id: 's2', status: 'draft', currentWordCount: 1000 }),
    ];
    const goals = makeGoals({ mode: 'perScene', targetCountPerScene: 2000 });
    // scene1 complete → 1, scene2 → 1000/2000 = 0.5, avg = 0.75
    expect(getOverallProgress(scenes, goals)).toBe(0.75);
  });

  it('mode none: ratio of completed scenes', () => {
    const scenes = [
      makeScene({ id: 's1', status: 'complete' }),
      makeScene({ id: 's2', status: 'revision' }),
      makeScene({ id: 's3', status: 'draft' }),
    ];
    // 2 complete / 3 total
    expect(getOverallProgress(scenes, makeGoals({ mode: 'none' }))).toBeCloseTo(2 / 3);
  });
});

// ─── getCompletedScenesCount / getIncompleteScenesCount ───

describe('getCompletedScenesCount / getIncompleteScenesCount', () => {
  let getCompletedScenesCount: typeof import('@/lib/calculations').getCompletedScenesCount;
  let getIncompleteScenesCount: typeof import('@/lib/calculations').getIncompleteScenesCount;

  beforeEach(async () => {
    ({ getCompletedScenesCount, getIncompleteScenesCount } = await import('@/lib/calculations'));
  });

  it('counts completed and incomplete correctly', () => {
    const scenes = [
      makeScene({ id: 's1', status: 'complete' }),
      makeScene({ id: 's2', status: 'revision' }),
      makeScene({ id: 's3', status: 'draft' }),
      makeScene({ id: 's4', status: 'outline' }),
    ];
    expect(getCompletedScenesCount(scenes)).toBe(2);
    expect(getIncompleteScenesCount(scenes)).toBe(2);
  });
});

// ─── getDailyGoal ───

describe('getDailyGoal', () => {
  let getDailyGoal: typeof import('@/lib/calculations').getDailyGoal;

  beforeEach(async () => {
    ({ getDailyGoal } = await import('@/lib/calculations'));
    vi.useFakeTimers();
    // Set "today" to a known date (not excluded)
    vi.setSystemTime(new Date('2025-03-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when objective disabled', () => {
    expect(getDailyGoal([], makeGoals({ objectiveEnabled: false }))).toBeNull();
  });

  it('returns null when objective is time-based', () => {
    expect(getDailyGoal([], makeGoals({ objectiveEnabled: true, objectiveType: 'time' }))).toBeNull();
  });

  it('returns null when today is excluded', () => {
    const goals = makeGoals({
      objectiveEnabled: true,
      objectiveType: 'wordCount',
      manualDailyGoal: 1000,
      excludedPeriods: [{ id: 'p1', startDate: '2025-03-10', endDate: '2025-03-20', label: 'break' }],
    });
    expect(getDailyGoal([], goals)).toBeNull();
  });

  it('mode total + deadline: auto-calculates remaining / working days', () => {
    const scenes = [
      makeScene({ id: 's1', currentWordCount: 5000 }),
    ];
    const goals = makeGoals({
      mode: 'total',
      targetTotalCount: 50000,
      objectiveEnabled: true,
      objectiveType: 'wordCount',
      targetEndDate: '2025-04-15', // 31 days from March 15
    });
    const result = getDailyGoal(scenes, goals);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
    // remaining = 45000, ~31 working days → ~1452/day
    expect(result!).toBe(Math.ceil(45000 / 31));
  });

  it('mode none: falls back to manualDailyGoal', () => {
    const goals = makeGoals({
      mode: 'none',
      objectiveEnabled: true,
      objectiveType: 'wordCount',
      manualDailyGoal: 1500,
    });
    expect(getDailyGoal([], goals)).toBe(1500);
  });

  it('returns null when manualDailyGoal is not set in mode none', () => {
    const goals = makeGoals({
      mode: 'none',
      objectiveEnabled: true,
      objectiveType: 'wordCount',
    });
    expect(getDailyGoal([], goals)).toBeNull();
  });

  it('returns null when deadline is passed and working days = 0', () => {
    const goals = makeGoals({
      mode: 'total',
      targetTotalCount: 50000,
      objectiveEnabled: true,
      objectiveType: 'wordCount',
      targetEndDate: '2025-03-01', // already passed
    });
    // No manualDailyGoal fallback for mode 'total' with deadline
    expect(getDailyGoal([], goals)).toBeNull();
  });
});

// ─── getPageEstimate ───

describe('getPageEstimate', () => {
  let getPageEstimate: typeof import('@/lib/calculations').getPageEstimate;

  beforeEach(async () => {
    ({ getPageEstimate } = await import('@/lib/calculations'));
  });

  it('calculates pages from words (250 words/page)', () => {
    expect(getPageEstimate(500, 'words')).toBe(2);
    expect(getPageEstimate(251, 'words')).toBe(2);
    expect(getPageEstimate(250, 'words')).toBe(1);
  });

  it('calculates pages from characters (converts via ratio 6)', () => {
    // 1500 chars / 6 = 250 words → 1 page
    expect(getPageEstimate(1500, 'characters')).toBe(1);
    // 3000 chars / 6 = 500 words → 2 pages
    expect(getPageEstimate(3000, 'characters')).toBe(2);
  });

  it('defaults to words unit', () => {
    expect(getPageEstimate(750)).toBe(3);
  });
});

// ─── getBookType ───

describe('getBookType', () => {
  let getBookType: typeof import('@/lib/calculations').getBookType;

  beforeEach(async () => {
    ({ getBookType } = await import('@/lib/calculations'));
  });

  it('micro-nouvelle: ≤ 1000 words', () => {
    expect(getBookType(500).type).toBe('micro_nouvelle');
    expect(getBookType(1000).type).toBe('micro_nouvelle');
  });

  it('nouvelle: 1001–15000 words', () => {
    expect(getBookType(1001).type).toBe('nouvelle');
    expect(getBookType(15000).type).toBe('nouvelle');
  });

  it('novella: 15001–30000 words', () => {
    expect(getBookType(15001).type).toBe('novella');
    expect(getBookType(30000).type).toBe('novella');
  });

  it('roman court: 30001–50000 words', () => {
    expect(getBookType(30001).type).toBe('roman_court');
    expect(getBookType(50000).type).toBe('roman_court');
  });

  it('roman: 50001–80000 words', () => {
    expect(getBookType(50001).type).toBe('roman');
    expect(getBookType(80000).type).toBe('roman');
  });

  it('long roman: 80001–110000 words', () => {
    expect(getBookType(80001).type).toBe('long_roman');
    expect(getBookType(110000).type).toBe('long_roman');
  });

  it('très long roman: > 110000 words', () => {
    expect(getBookType(110001).type).toBe('tres_long_roman');
    expect(getBookType(500000).type).toBe('tres_long_roman');
  });

  it('works with characters unit', () => {
    // 6000 chars → micro_nouvelle boundary
    expect(getBookType(6000, 'characters').type).toBe('micro_nouvelle');
    expect(getBookType(6001, 'characters').type).toBe('nouvelle');
  });

  it('includes pages in result', () => {
    const result = getBookType(50000);
    expect(result.pages).toBe(200); // 50000/250
  });
});

// ─── estimateFromScenes ───

describe('estimateFromScenes', () => {
  let estimateFromScenes: typeof import('@/lib/calculations').estimateFromScenes;

  beforeEach(async () => {
    ({ estimateFromScenes } = await import('@/lib/calculations'));
  });

  it('returns zeros when no scenes have content', () => {
    const scenes = [makeScene({ currentWordCount: 0 }), makeScene({ id: 's2', currentWordCount: 0 })];
    const result = estimateFromScenes(scenes);
    expect(result.estimatedTotal).toBe(0);
    expect(result.estimatedPerScene).toBe(0);
    expect(result.completedCount).toBe(0);
  });

  it('estimates from completed scenes', () => {
    const scenes = [
      makeScene({ id: 's1', status: 'complete', currentWordCount: 2000 }),
      makeScene({ id: 's2', status: 'complete', currentWordCount: 3000 }),
      makeScene({ id: 's3', status: 'draft', currentWordCount: 500 }),
    ];
    const result = estimateFromScenes(scenes);
    expect(result.completedCount).toBe(2);
    expect(result.estimatedPerScene).toBe(2500); // (2000+3000)/2
    expect(result.estimatedTotal).toBe(7500); // 2500 * 3 scenes
  });

  it('falls back to scenes with content when none completed', () => {
    const scenes = [
      makeScene({ id: 's1', status: 'draft', currentWordCount: 1000 }),
      makeScene({ id: 's2', status: 'draft', currentWordCount: 2000 }),
      makeScene({ id: 's3', status: 'draft', currentWordCount: 0 }),
    ];
    const result = estimateFromScenes(scenes);
    expect(result.completedCount).toBe(0);
    expect(result.estimatedPerScene).toBe(1500); // (1000+2000)/2
    expect(result.estimatedTotal).toBe(4500); // 1500 * 3
  });
});

// ─── getTodayProgress ───

describe('getTodayProgress', () => {
  let getTodayProgress: typeof import('@/lib/calculations').getTodayProgress;

  // Mock localStorage in node environment
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
    get length() { return storage.size; },
    key: (_i: number) => null as string | null,
  };

  beforeEach(async () => {
    storage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = localStorageMock;
    ({ getTodayProgress } = await import('@/lib/calculations'));
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
  });

  it('returns 0 and does not create snapshot when currentTotal is 0 (data not loaded)', () => {
    const result = getTodayProgress('book-1', 0);
    expect(result.todayCount).toBe(0);
    expect(result.startOfDayTotal).toBe(0);
    // Must NOT have written to localStorage
    expect(storage.has('emlb-daily-snapshot:book-1')).toBe(false);
  });

  it('creates snapshot on first call with real data', () => {
    const result = getTodayProgress('book-1', 5000);
    expect(result.todayCount).toBe(0);
    expect(result.startOfDayTotal).toBe(5000);
    // Snapshot must exist
    const stored = JSON.parse(storage.get('emlb-daily-snapshot:book-1')!);
    expect(stored.total).toBe(5000);
  });

  it('tracks progress correctly after snapshot is created', () => {
    // First call: snapshot with 5000
    getTodayProgress('book-1', 5000);
    // User writes 300 more words
    const result = getTodayProgress('book-1', 5300);
    expect(result.todayCount).toBe(300);
    expect(result.startOfDayTotal).toBe(5000);
  });

  it('BUG FIX: does not poison snapshot when called with 0 then real data', () => {
    // Simulate race condition: first render with scenes=[] → total=0
    const r1 = getTodayProgress('book-1', 0);
    expect(r1.todayCount).toBe(0);
    // No snapshot should exist
    expect(storage.has('emlb-daily-snapshot:book-1')).toBe(false);

    // Cloud data arrives → scenes load → total=45000
    const r2 = getTodayProgress('book-1', 45000);
    expect(r2.todayCount).toBe(0); // Must be 0, not 45000!
    expect(r2.startOfDayTotal).toBe(45000);
  });

  it('repairs a poisoned snapshot (total=0 with real data)', () => {
    // Simulate a pre-fix poisoned snapshot already in localStorage
    const todayStr = new Date().toISOString().split('T')[0];
    storage.set('emlb-daily-snapshot:book-1', JSON.stringify({ date: todayStr, total: 0 }));

    const result = getTodayProgress('book-1', 45000);
    expect(result.todayCount).toBe(0); // Repaired: should be 0, not 45000
    expect(result.startOfDayTotal).toBe(45000);
    // Snapshot must be updated
    const stored = JSON.parse(storage.get('emlb-daily-snapshot:book-1')!);
    expect(stored.total).toBe(45000);
  });

  it('handles new day correctly (resets snapshot)', () => {
    // Yesterday's snapshot
    storage.set('emlb-daily-snapshot:book-1', JSON.stringify({ date: '2020-01-01', total: 3000 }));

    const result = getTodayProgress('book-1', 5000);
    expect(result.todayCount).toBe(0); // New day → reset
    expect(result.startOfDayTotal).toBe(5000);
  });

  it('handles corrupt stored data gracefully', () => {
    storage.set('emlb-daily-snapshot:book-1', 'not-json');

    const result = getTodayProgress('book-1', 5000);
    expect(result.todayCount).toBe(0);
    expect(result.startOfDayTotal).toBe(5000);
  });
});
