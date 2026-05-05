/**
 * Mesure et limitation d'usage IA (côté serveur).
 *
 * Modèle : fenêtre glissante 7 jours. On stocke la liste des timestamps
 * de chaque génération réussie, par utilisateur.
 *
 * Clés Redis :
 *   emlb:ai:usage:{userId}        → JSON AiUsageEntry[] (purgé > 7j à la lecture)
 *   emlb:ai:limits:default        → JSON AiLimits (overridable par admin)
 *   emlb:ai:limits:user:{userId}  → JSON AiLimits (override par utilisateur)
 *
 * Note : les types `AiFeatureId`, `AiLimits`, etc. sont définis côté src/types.
 * On les redéclare ici pour éviter une dépendance cross-package (api/ a son
 * propre tsconfig commonjs).
 */

import { redis } from './redis';

export type AiFeatureId = 'character_image';

export interface AiUsageEntry {
  feature: AiFeatureId;
  ts: string;
}

export interface AiLimits {
  perWeek: Partial<Record<AiFeatureId, number>>;
}

export interface AiFeatureUsage {
  feature: AiFeatureId;
  used: number;
  limit: number;
  nextAvailableAt: string | null;
}

export interface AiUsageSummary {
  features: AiFeatureUsage[];
  limits: AiLimits;
  hasOverride: boolean;
  now: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const FEATURE_DEFAULTS: Record<AiFeatureId, number> = {
  character_image: 5,
};

const ALL_FEATURES: AiFeatureId[] = ['character_image'];

function usageKey(userId: string): string { return `emlb:ai:usage:${userId}`; }
function userLimitsKey(userId: string): string { return `emlb:ai:limits:user:${userId}`; }
const DEFAULT_LIMITS_KEY = 'emlb:ai:limits:default';

function defaultLimits(): AiLimits {
  return { perWeek: { ...FEATURE_DEFAULTS } };
}

async function readDefaultLimits(): Promise<AiLimits> {
  const raw = await redis.get(DEFAULT_LIMITS_KEY);
  if (!raw) return defaultLimits();
  try {
    const parsed = JSON.parse(raw) as AiLimits;
    return { perWeek: { ...FEATURE_DEFAULTS, ...(parsed.perWeek ?? {}) } };
  } catch {
    return defaultLimits();
  }
}

async function readEffectiveLimits(userId: string): Promise<{ limits: AiLimits; hasOverride: boolean }> {
  const raw = await redis.get(userLimitsKey(userId));
  if (!raw) return { limits: await readDefaultLimits(), hasOverride: false };
  try {
    const override = JSON.parse(raw) as AiLimits;
    const base = await readDefaultLimits();
    return {
      limits: { perWeek: { ...base.perWeek, ...(override.perWeek ?? {}) } },
      hasOverride: true,
    };
  } catch {
    return { limits: await readDefaultLimits(), hasOverride: false };
  }
}

async function readEntries(userId: string): Promise<AiUsageEntry[]> {
  const raw = await redis.get(usageKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AiUsageEntry[];
  } catch {
    return [];
  }
}

function pruned(entries: AiUsageEntry[], now: number): AiUsageEntry[] {
  return entries.filter((e) => now - new Date(e.ts).getTime() < WEEK_MS);
}

function buildFeatureUsage(entries: AiUsageEntry[], feature: AiFeatureId, limit: number, now: number): AiFeatureUsage {
  const featureEntries = entries.filter((e) => e.feature === feature && now - new Date(e.ts).getTime() < WEEK_MS);
  let nextAvailableAt: string | null = null;
  if (featureEntries.length >= limit && featureEntries.length > 0) {
    const oldest = featureEntries.reduce((acc, cur) => (new Date(cur.ts).getTime() < new Date(acc.ts).getTime() ? cur : acc));
    nextAvailableAt = new Date(new Date(oldest.ts).getTime() + WEEK_MS).toISOString();
  }
  return { feature, used: featureEntries.length, limit, nextAvailableAt };
}

export async function getUsageSummary(userId: string): Promise<AiUsageSummary> {
  const { limits, hasOverride } = await readEffectiveLimits(userId);
  const entries = await readEntries(userId);
  const now = Date.now();
  const features = ALL_FEATURES.map((f) => buildFeatureUsage(entries, f, limits.perWeek[f] ?? 0, now));
  return { features, limits, hasOverride, now: new Date(now).toISOString() };
}

/**
 * Vérifie le quota et incrémente l'usage de manière atomique au niveau applicatif
 * (suffisant pour notre charge — pas de WATCH/MULTI car Upstash REST ne le supporte
 * pas trivialement, et deux générations simultanées du même user sont marginales).
 */
export async function checkAndIncrementUsage(userId: string, feature: AiFeatureId): Promise<AiUsageSummary> {
  const { limits } = await readEffectiveLimits(userId);
  const limit = limits.perWeek[feature] ?? 0;
  const entries = pruned(await readEntries(userId), Date.now());
  const used = entries.filter((e) => e.feature === feature).length;
  if (used >= limit) {
    const err = new Error(`Quota IA atteint pour cette semaine (${used}/${limit})`);
    (err as Error & { code?: string }).code = 'QUOTA_EXCEEDED';
    throw err;
  }
  const now = Date.now();
  entries.push({ feature, ts: new Date(now).toISOString() });
  await redis.set(usageKey(userId), JSON.stringify(entries));
  return getUsageSummary(userId);
}

/**
 * Annule le dernier crédit consommé pour cette feature (utilisé en cas
 * d'échec downstream après incrément, ex. NSFW filter, blob upload critique).
 */
export async function refundLastUsage(userId: string, feature: AiFeatureId): Promise<AiUsageSummary> {
  const entries = await readEntries(userId);
  // Trouve l'entrée la plus récente de cette feature et la supprime.
  let lastIdx = -1;
  let lastTs = -Infinity;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].feature === feature) {
      const ts = new Date(entries[i].ts).getTime();
      if (ts > lastTs) { lastTs = ts; lastIdx = i; }
    }
  }
  if (lastIdx >= 0) {
    entries.splice(lastIdx, 1);
    await redis.set(usageKey(userId), JSON.stringify(entries));
  }
  return getUsageSummary(userId);
}

export async function setUserLimits(userId: string, limits: AiLimits | null): Promise<void> {
  if (limits === null) {
    await redis.del(userLimitsKey(userId));
    return;
  }
  await redis.set(userLimitsKey(userId), JSON.stringify(limits));
}
