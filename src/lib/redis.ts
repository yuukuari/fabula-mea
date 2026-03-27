/**
 * Client REST Upstash Redis — utilise fetch directement (compatible navigateur/Vite).
 * Aucun SDK Node.js requis. Variables d'environnement :
 *   VITE_UPSTASH_REDIS_REST_URL   → URL REST de la base (ex: https://xxx.upstash.io)
 *   VITE_UPSTASH_REDIS_REST_TOKEN → Bearer token Upstash
 *
 * Note : ces variables sont embarquées dans le bundle client. Pour un usage personnel
 * c'est acceptable ; ne pas partager ce token publiquement.
 */

const BASE_URL = (import.meta.env.VITE_UPSTASH_REDIS_REST_URL as string | undefined)?.replace(/\/$/, '');
const TOKEN    = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN as string | undefined;

export const isRedisConfigured = !!(BASE_URL && TOKEN);

type RedisResponse<T> = { result: T; error?: never } | { result?: never; error: string };

/**
 * Exécute une commande Redis via l'API REST Upstash.
 * Format : POST /{command}  body: [arg1, arg2, ...]
 */
async function redisCmd<T = unknown>(command: string, args: (string | number)[]): Promise<T> {
  if (!BASE_URL || !TOKEN) throw new Error('Redis non configuré');
  const res = await fetch(`${BASE_URL}/${command.toLowerCase()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const data = (await res.json()) as RedisResponse<T>;
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result as T;
}

/** Lit une clé. Retourne null si absente ou en cas d'erreur. */
export async function redisGet(key: string): Promise<string | null> {
  try {
    const result = await redisCmd<string | null>('GET', [key]);
    return typeof result === 'string' ? result : null;
  } catch {
    return null;
  }
}

/** Écrit une valeur (chaîne JSON). Lance une exception en cas d'erreur. */
export async function redisSet(key: string, value: string): Promise<void> {
  await redisCmd<string>('SET', [key, value]);
}

/** Supprime une clé. Silencieux en cas d'erreur. */
export async function redisDel(key: string): Promise<void> {
  try {
    await redisCmd<number>('DEL', [key]);
  } catch {
    // silencieux
  }
}
