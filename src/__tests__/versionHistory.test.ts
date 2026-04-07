import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for the version history logic (dev-db pattern).
 * We replicate the core logic here to test it in isolation without
 * needing a real localStorage or auth context.
 */

interface VersionStats {
  chapters: number;
  scenes: number;
  events: number;
  words: number;
  characters: number;
  places: number;
  worldNotes: number;
  maps: number;
  notes: number;
}

interface VersionMeta {
  savedAt: string;
  title: string;
  stats: VersionStats;
  index: number;
  isRestore?: boolean;
}

interface VersionEntry {
  meta: Omit<VersionMeta, 'index'>;
  data: Record<string, unknown>;
  sagaData?: Record<string, unknown>;
}

const MAX_VERSIONS = 20;
const DEDUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

// --- Extracted logic (mirrors dev-db.ts) ---

function extractStats(bookData: Record<string, unknown>, sagaData?: Record<string, unknown>): VersionStats {
  const chapters = Array.isArray(bookData.chapters)
    ? (bookData.chapters as Array<{ type?: string }>).filter((c) => c.type === 'chapter').length
    : 0;
  const scenes = Array.isArray(bookData.scenes) ? bookData.scenes.length : 0;
  const events = Array.isArray(bookData.timelineEvents) ? bookData.timelineEvents.length : 0;
  const words = Array.isArray(bookData.scenes)
    ? (bookData.scenes as Array<{ currentWordCount?: number }>).reduce((sum, s) => sum + (s.currentWordCount ?? 0), 0)
    : 0;
  const encSource = sagaData ?? bookData;
  const characters = Array.isArray(encSource.characters) ? encSource.characters.length : 0;
  const places = Array.isArray(encSource.places) ? encSource.places.length : 0;
  const worldNotes = Array.isArray(encSource.worldNotes) ? encSource.worldNotes.length : 0;
  const maps = Array.isArray(encSource.maps) ? encSource.maps.length : 0;
  const notes = Array.isArray(bookData.noteIdeas) ? bookData.noteIdeas.length : 0;
  return { chapters, scenes, events, words, characters, places, worldNotes, maps, notes };
}

function recordIfNeeded(
  history: VersionEntry[],
  currentData: Record<string, unknown>,
  sagaData?: Record<string, unknown>,
): VersionEntry[] {
  const result = [...history];
  // Dedup by time
  if (result.length > 0) {
    const lastSavedAt = new Date(result[0].meta.savedAt).getTime();
    if (Date.now() - lastSavedAt < DEDUP_INTERVAL) return result;
  }
  // Dedup by content: skip if book updatedAt hasn't changed
  if (result.length > 0) {
    const lastData = result[0].data;
    if (lastData.updatedAt === currentData.updatedAt) {
      return result;
    }
  }
  result.unshift({
    meta: {
      savedAt: new Date().toISOString(),
      title: (currentData.title as string) ?? '',
      stats: extractStats(currentData, sagaData),
    },
    data: currentData,
    ...(sagaData ? { sagaData } : {}),
  });
  if (result.length > MAX_VERSIONS) result.length = MAX_VERSIONS;
  return result;
}

function restore(
  history: VersionEntry[],
  index: number,
  currentData: Record<string, unknown>,
  currentSagaData?: Record<string, unknown>,
): { newHistory: VersionEntry[]; restoredData: Record<string, unknown>; restoredSagaData?: Record<string, unknown> } {
  if (index < 0 || index >= history.length) throw new Error('Version introuvable');

  const result = [...history];
  const entryToRestore = result[index];

  // Save current as restore point
  result.unshift({
    meta: {
      savedAt: new Date().toISOString(),
      title: (currentData.title as string) ?? '',
      stats: extractStats(currentData, currentSagaData),
      isRestore: true,
    },
    data: currentData,
    ...(currentSagaData ? { sagaData: currentSagaData } : {}),
  });
  if (result.length > MAX_VERSIONS) result.length = MAX_VERSIONS;

  const restoredData = { ...entryToRestore.data, updatedAt: new Date().toISOString() };

  return {
    newHistory: result,
    restoredData,
    restoredSagaData: entryToRestore.sagaData ? { ...entryToRestore.sagaData, updatedAt: new Date().toISOString() } : undefined,
  };
}

// --- Tests ---

describe('extractStats', () => {
  it('counts book data correctly', () => {
    const bookData = {
      chapters: [{ type: 'chapter' }, { type: 'chapter' }, { type: 'front_matter' }],
      scenes: [{ currentWordCount: 100 }, { currentWordCount: 200 }],
      timelineEvents: [{}, {}],
      characters: [{ name: 'A' }],
      places: [{ name: 'P' }],
      worldNotes: [],
      maps: [],
      noteIdeas: [{ title: 'N' }],
    };
    const stats = extractStats(bookData);
    expect(stats.chapters).toBe(2); // only type=chapter
    expect(stats.scenes).toBe(2);
    expect(stats.events).toBe(2);
    expect(stats.words).toBe(300);
    expect(stats.characters).toBe(1);
    expect(stats.places).toBe(1);
    expect(stats.worldNotes).toBe(0);
    expect(stats.maps).toBe(0);
    expect(stats.notes).toBe(1);
  });

  it('uses saga data for encyclopedia fields when provided', () => {
    const bookData = {
      chapters: [],
      scenes: [],
      characters: [{ name: 'book-char' }],
      places: [],
    };
    const sagaData = {
      characters: [{ name: 'saga-1' }, { name: 'saga-2' }],
      places: [{ name: 'place' }],
      worldNotes: [{ title: 'wn' }],
      maps: [{ name: 'map' }],
    };
    const stats = extractStats(bookData, sagaData);
    expect(stats.characters).toBe(2); // saga, not book
    expect(stats.places).toBe(1);
    expect(stats.worldNotes).toBe(1);
    expect(stats.maps).toBe(1);
  });

  it('handles empty/missing arrays gracefully', () => {
    const stats = extractStats({});
    expect(stats.chapters).toBe(0);
    expect(stats.scenes).toBe(0);
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.notes).toBe(0);
  });
});

describe('recordIfNeeded', () => {
  it('records a snapshot when history is empty', () => {
    const data = { title: 'Mon livre', chapters: [], scenes: [] };
    const result = recordIfNeeded([], data);
    expect(result.length).toBe(1);
    expect(result[0].meta.title).toBe('Mon livre');
    expect(result[0].data).toBe(data);
  });

  it('skips recording within the dedup interval', () => {
    const recentEntry: VersionEntry = {
      meta: { savedAt: new Date().toISOString(), title: 'v1', stats: extractStats({}) },
      data: {},
    };
    const data = { title: 'v2' };
    const result = recordIfNeeded([recentEntry], data);
    expect(result.length).toBe(1); // no new entry
    expect(result[0].meta.title).toBe('v1');
  });

  it('records after dedup interval', () => {
    const oldDate = new Date(Date.now() - DEDUP_INTERVAL - 1000);
    const oldEntry: VersionEntry = {
      meta: { savedAt: oldDate.toISOString(), title: 'v1', stats: extractStats({}) },
      data: { updatedAt: '2024-01-01T00:00:00Z' },
    };
    const data = { title: 'v2', updatedAt: '2024-01-01T01:00:00Z' };
    const result = recordIfNeeded([oldEntry], data);
    expect(result.length).toBe(2);
    expect(result[0].meta.title).toBe('v2');
    expect(result[1].meta.title).toBe('v1');
  });

  it('includes saga data in snapshot', () => {
    const bookData = { title: 'Book', sagaId: 'saga-1' };
    const sagaData = { characters: [{ name: 'Hero' }] };
    const result = recordIfNeeded([], bookData, sagaData);
    expect(result[0].sagaData).toEqual(sagaData);
  });

  it('skips recording when updatedAt is identical to last snapshot', () => {
    const data = { title: 'Mon livre', updatedAt: '2024-01-01T12:00:00Z' };
    const oldDate = new Date(Date.now() - DEDUP_INTERVAL - 1000);
    const existingEntry: VersionEntry = {
      meta: { savedAt: oldDate.toISOString(), title: 'Mon livre', stats: extractStats(data) },
      data: { ...data }, // same updatedAt
    };
    // Old enough by time — but updatedAt hasn't changed (no real edit)
    const result = recordIfNeeded([existingEntry], data);
    expect(result.length).toBe(1); // no new entry
  });

  it('records when updatedAt changed (real edit happened)', () => {
    const oldDate = new Date(Date.now() - DEDUP_INTERVAL - 1000);
    const existingEntry: VersionEntry = {
      meta: { savedAt: oldDate.toISOString(), title: 'Mon livre', stats: extractStats({}) },
      data: { title: 'Mon livre', updatedAt: '2024-01-01T12:00:00Z' },
    };
    // Same title/stats but updatedAt changed → setting change, layout change, etc.
    const newData = { title: 'Mon livre', updatedAt: '2024-01-01T14:00:00Z' };
    const result = recordIfNeeded([existingEntry], newData);
    expect(result.length).toBe(2);
  });

  it('caps history at MAX_VERSIONS', () => {
    const old = Array.from({ length: 20 }, (_, i) => ({
      meta: {
        savedAt: new Date(Date.now() - (DEDUP_INTERVAL + 1000) * (i + 1)).toISOString(),
        title: `v${i}`,
        stats: extractStats({}),
      },
      data: { updatedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` },
    }));
    // New data with different updatedAt
    const result = recordIfNeeded(old, { title: 'new', updatedAt: '2024-02-01T00:00:00Z' });
    expect(result.length).toBe(MAX_VERSIONS);
    expect(result[0].meta.title).toBe('new');
  });
});

describe('restore', () => {
  let history: VersionEntry[];

  beforeEach(() => {
    history = [
      { meta: { savedAt: '2024-01-01T00:00:00Z', title: 'v1', stats: extractStats({}) }, data: { title: 'v1', content: 'hello' } },
      { meta: { savedAt: '2024-01-01T01:00:00Z', title: 'v2', stats: extractStats({}) }, data: { title: 'v2', content: 'world' } },
    ];
  });

  it('restores the correct version data', () => {
    const current = { title: 'current' };
    const { restoredData } = restore(history, 1, current);
    expect(restoredData.title).toBe('v2');
    expect(restoredData.content).toBe('world');
    expect(restoredData.updatedAt).toBeDefined();
  });

  it('saves current state as restore point with isRestore flag', () => {
    const current = { title: 'current' };
    const { newHistory } = restore(history, 0, current);
    expect(newHistory[0].meta.isRestore).toBe(true);
    expect(newHistory[0].meta.title).toBe('current');
    expect(newHistory[0].data).toEqual(current);
  });

  it('uses the pre-saved reference (not shifted index)', () => {
    // This tests the critical fix: grab entryToRestore BEFORE unshift
    const current = { title: 'current' };
    const { restoredData } = restore(history, 0, current);
    // Should restore v1 (index 0 before unshift), not current
    expect(restoredData.title).toBe('v1');
  });

  it('includes saga data in restore point and restored data', () => {
    const sagaHistory: VersionEntry[] = [
      {
        meta: { savedAt: '2024-01-01T00:00:00Z', title: 'v1', stats: extractStats({}) },
        data: { title: 'v1', sagaId: 'saga-1' },
        sagaData: { characters: [{ name: 'OldHero' }] },
      },
    ];
    const current = { title: 'current', sagaId: 'saga-1' };
    const currentSaga = { characters: [{ name: 'NewHero' }] };

    const { newHistory, restoredSagaData } = restore(sagaHistory, 0, current, currentSaga);

    // Restore point should include current saga
    expect(newHistory[0].sagaData).toEqual(currentSaga);
    // Restored saga should be the old one
    expect((restoredSagaData as Record<string, unknown>).characters).toEqual([{ name: 'OldHero' }]);
  });

  it('caps history at MAX_VERSIONS after adding restore point', () => {
    const fullHistory = Array.from({ length: 20 }, (_, i) => ({
      meta: { savedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, title: `v${i}`, stats: extractStats({}) },
      data: { title: `v${i}` },
    }));
    const { newHistory } = restore(fullHistory, 19, { title: 'current' });
    expect(newHistory.length).toBe(MAX_VERSIONS);
    // First entry is the restore point
    expect(newHistory[0].meta.isRestore).toBe(true);
  });

  it('throws for invalid index', () => {
    expect(() => restore(history, -1, {})).toThrow('Version introuvable');
    expect(() => restore(history, 5, {})).toThrow('Version introuvable');
  });
});
