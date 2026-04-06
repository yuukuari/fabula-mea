import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from '../_lib/redis';
import { requireAuth } from '../_lib/auth';
import { cors } from '../_lib/cors';

const MAX_VERSIONS = 20;

interface VersionMeta {
  savedAt: string;
  title: string;
  stats: {
    chapters: number;
    scenes: number;
    events: number;
    words: number;
    characters: number;
    places: number;
    worldNotes: number;
    maps: number;
    notes: number;
  };
  isRestore?: boolean;
}

interface VersionEntry {
  meta: VersionMeta;
  data: Record<string, unknown>;
  sagaData?: Record<string, unknown>;
}

function extractStats(bookData: Record<string, unknown>, sagaData?: Record<string, unknown>): VersionMeta['stats'] {
  const chapters = Array.isArray(bookData.chapters)
    ? (bookData.chapters as Array<{ type?: string }>).filter((c) => c.type === 'chapter').length
    : 0;
  const scenes = Array.isArray(bookData.scenes) ? bookData.scenes.length : 0;
  const events = Array.isArray(bookData.timelineEvents) ? bookData.timelineEvents.length : 0;
  const words = Array.isArray(bookData.scenes)
    ? (bookData.scenes as Array<{ currentWordCount?: number }>).reduce((sum, s) => sum + (s.currentWordCount ?? 0), 0)
    : 0;
  // Characters/places/worldNotes/maps: use saga data if available, otherwise book data
  const encSource = sagaData ?? bookData;
  const characters = Array.isArray(encSource.characters) ? encSource.characters.length : 0;
  const places = Array.isArray(encSource.places) ? encSource.places.length : 0;
  const worldNotes = Array.isArray(encSource.worldNotes) ? encSource.worldNotes.length : 0;
  const maps = Array.isArray(encSource.maps) ? encSource.maps.length : 0;
  const notes = Array.isArray(bookData.noteIdeas) ? bookData.noteIdeas.length : 0;
  return { chapters, scenes, events, words, characters, places, worldNotes, maps, notes };
}

/** Fetch saga data for a book if it belongs to a saga */
async function getSagaData(userId: string, bookData: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
  const sagaId = bookData.sagaId as string | undefined;
  if (!sagaId) return undefined;
  const raw = await redis.get(`emlb:u:${userId}:saga:${sagaId}`);
  if (!raw) return undefined;
  return JSON.parse(raw) as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = requireAuth(req, res);
  if (!auth) return;

  const { bookId } = req.query as { bookId: string };
  if (!bookId) return res.status(400).json({ error: 'bookId manquant' });

  const key = `emlb:u:${auth.userId}:book:${bookId}`;
  const historyKey = `emlb:u:${auth.userId}:book:${bookId}:history`;

  // ─── GET /api/book/{bookId}?history → list version metadata ───
  if (req.method === 'GET' && req.query.history !== undefined) {
    const raw = await redis.lrange(historyKey, 0, MAX_VERSIONS - 1);
    const versions: (VersionMeta & { index: number })[] = [];
    for (let i = 0; i < raw.length; i++) {
      try {
        const entry = JSON.parse(raw[i]) as VersionEntry;
        versions.push({ ...entry.meta, index: i });
      } catch {
        // skip corrupted entries
      }
    }
    return res.json({ versions });
  }

  // ─── GET /api/book/{bookId}?version=N → get full version data ───
  if (req.method === 'GET' && req.query.version !== undefined) {
    const index = parseInt(req.query.version as string, 10);
    if (isNaN(index) || index < 0) return res.status(400).json({ error: 'Index invalide' });
    const raw = await redis.lindex(historyKey, index);
    if (!raw) return res.status(404).json({ error: 'Version introuvable' });
    try {
      const entry = JSON.parse(raw) as VersionEntry;
      return res.json({ meta: entry.meta, data: entry.data, ...(entry.sagaData ? { sagaData: entry.sagaData } : {}) });
    } catch {
      return res.status(500).json({ error: 'Version corrompue' });
    }
  }

  // ─── GET /api/book/{bookId} → get current book ───
  if (req.method === 'GET') {
    const json = await redis.get(key);
    if (!json) return res.status(404).json({ error: 'Livre introuvable' });
    return res.json(JSON.parse(json));
  }

  // ─── POST /api/book/{bookId}?restore=N → restore a version ───
  if (req.method === 'POST' && req.query.restore !== undefined) {
    const index = parseInt(req.query.restore as string, 10);
    if (isNaN(index) || index < 0) return res.status(400).json({ error: 'Index invalide' });
    const raw = await redis.lindex(historyKey, index);
    if (!raw) return res.status(404).json({ error: 'Version introuvable' });
    try {
      const entry = JSON.parse(raw) as VersionEntry;
      // Save current as a new history entry before restoring
      const currentJson = await redis.get(key);
      if (currentJson) {
        const currentData = JSON.parse(currentJson) as Record<string, unknown>;
        const currentSagaData = await getSagaData(auth.userId, currentData);
        const historyEntry: VersionEntry = {
          meta: {
            savedAt: new Date().toISOString(),
            title: (currentData.title as string) ?? '',
            stats: extractStats(currentData, currentSagaData),
            isRestore: true,
          },
          data: currentData,
          ...(currentSagaData ? { sagaData: currentSagaData } : {}),
        };
        await redis.lpush(historyKey, JSON.stringify(historyEntry));
        await redis.ltrim(historyKey, 0, MAX_VERSIONS - 1);
      }
      // Restore the book
      const restoredData = entry.data;
      restoredData.updatedAt = new Date().toISOString();
      await redis.set(key, JSON.stringify(restoredData));

      // Restore the saga if snapshot included saga data
      if (entry.sagaData && restoredData.sagaId) {
        const sagaKey = `emlb:u:${auth.userId}:saga:${restoredData.sagaId as string}`;
        const restoredSaga = { ...entry.sagaData, updatedAt: new Date().toISOString() };
        await redis.set(sagaKey, JSON.stringify(restoredSaga));
      }

      return res.json({ ok: true, data: restoredData });
    } catch {
      return res.status(500).json({ error: 'Version corrompue' });
    }
  }

  // ─── POST /api/book/{bookId} → save book (with version history) ───
  if (req.method === 'POST') {
    // Save previous version to history before overwriting
    const previousJson = await redis.get(key);
    if (previousJson) {
      try {
        const previousData = JSON.parse(previousJson) as Record<string, unknown>;
        let shouldSaveHistory = true;

        // Check last history entry timestamp to avoid flooding
        const lastRaw = await redis.lindex(historyKey, 0);
        if (lastRaw) {
          const lastEntry = JSON.parse(lastRaw) as VersionEntry;
          const lastSavedAt = new Date(lastEntry.meta.savedAt).getTime();
          const now = Date.now();
          if (now - lastSavedAt < 15 * 60 * 1000) {
            shouldSaveHistory = false;
          }
        }

        if (shouldSaveHistory) {
          const previousSagaData = await getSagaData(auth.userId, previousData);
          const historyEntry: VersionEntry = {
            meta: {
              savedAt: new Date().toISOString(),
              title: (previousData.title as string) ?? '',
              stats: extractStats(previousData, previousSagaData),
            },
            data: previousData,
            ...(previousSagaData ? { sagaData: previousSagaData } : {}),
          };
          await redis.lpush(historyKey, JSON.stringify(historyEntry));
          await redis.ltrim(historyKey, 0, MAX_VERSIONS - 1);
        }
      } catch {
        // Don't fail the save if history fails
      }
    }
    await redis.set(key, JSON.stringify(req.body));
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await redis.del(key);
    // Also clean up history
    await redis.del(historyKey).catch(() => {});
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
