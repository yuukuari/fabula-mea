/**
 * Server-side Redis client — Upstash REST API.
 * Uses process.env (no VITE_ prefix) — safe, never exposed to the browser.
 */

const BASE_URL = (process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

type RedisResult<T> = { result: T; error?: undefined } | { result?: undefined; error: string };

async function cmd<T>(command: string, args: (string | number)[]): Promise<T> {
  if (!BASE_URL || !TOKEN) throw new Error('Redis non configuré (UPSTASH_REDIS_REST_URL / TOKEN manquants)');
  // Upstash REST API: POST to root with [COMMAND, ...args] as body
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command.toUpperCase(), ...args]),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const data = (await res.json()) as RedisResult<T>;
  if (data.error) throw new Error(`Redis: ${data.error}`);
  return data.result as T;
}

export const redis = {
  get: (key: string): Promise<string | null> =>
    cmd<string | null>('GET', [key]).catch(() => null),
  set: (key: string, value: string): Promise<void> =>
    cmd<string>('SET', [key, value]).then(() => undefined),
  setex: (key: string, ttlSeconds: number, value: string): Promise<void> =>
    cmd<string>('SET', [key, value, 'EX', ttlSeconds]).then(() => undefined),
  del: (key: string): Promise<void> =>
    cmd<number>('DEL', [key]).then(() => undefined),
  // List operations (for version history)
  lpush: (key: string, value: string): Promise<number> =>
    cmd<number>('LPUSH', [key, value]),
  lrange: (key: string, start: number, stop: number): Promise<string[]> =>
    cmd<string[]>('LRANGE', [key, start, stop]).catch(() => []),
  lindex: (key: string, index: number): Promise<string | null> =>
    cmd<string | null>('LINDEX', [key, index]).catch(() => null),
  ltrim: (key: string, start: number, stop: number): Promise<void> =>
    cmd<string>('LTRIM', [key, start, stop]).then(() => undefined),
};
