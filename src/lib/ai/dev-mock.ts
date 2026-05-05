/**
 * Mock IA en dev — stocke usage en localStorage, retourne une image placeholder.
 *
 * Clés :
 *   emlb-dev:ai:usage:{userId}     → AiUsageEntry[]
 *   emlb-dev:ai:limits:default     → AiLimits
 *   emlb-dev:ai:limits:user:{id}   → AiLimits (override)
 */

import type { AiFeatureId, AiLimits, AiUsageEntry, AiUsageSummary, AiImageStyle, AiFeatureUsage } from '@/types';
import { AI_FEATURES, defaultAiLimits } from './features';
import { devAuth } from '@/lib/dev-auth';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // localStorage saturé : on log mais on n'interrompt pas une génération qui a
    // potentiellement déjà coûté un appel fal.ai. Le compteur sera juste un peu décalé.
    if (err instanceof DOMException && /quota/i.test(err.name + err.message)) {
      console.warn(`[ai] localStorage saturé — écriture ignorée pour ${key}. Libérez de l'espace (DevTools → Application → Local Storage).`);
      return;
    }
    throw err;
  }
}

function currentUserId(): string {
  const token = localStorage.getItem('emlb-token');
  if (!token || !token.startsWith('dev-')) throw new Error('Non authentifié');
  try {
    const payload = JSON.parse(atob(token.slice(4))) as { userId: string };
    return payload.userId;
  } catch {
    throw new Error('Token invalide');
  }
}

function usageKey(userId: string): string { return `emlb-dev:ai:usage:${userId}`; }
function userLimitsKey(userId: string): string { return `emlb-dev:ai:limits:user:${userId}`; }
const DEFAULT_LIMITS_KEY = 'emlb-dev:ai:limits:default';

function readDefaultLimits(): AiLimits {
  const stored = readJson<AiLimits | null>(DEFAULT_LIMITS_KEY, null);
  return stored ?? defaultAiLimits();
}

function readEffectiveLimits(userId: string): { limits: AiLimits; hasOverride: boolean } {
  const override = readJson<AiLimits | null>(userLimitsKey(userId), null);
  if (override) {
    const merged: AiLimits = { perWeek: { ...readDefaultLimits().perWeek, ...override.perWeek } };
    return { limits: merged, hasOverride: true };
  }
  return { limits: readDefaultLimits(), hasOverride: false };
}

function pruneAndCount(entries: AiUsageEntry[], feature: AiFeatureId, now: number): { active: AiUsageEntry[]; featureEntries: AiUsageEntry[] } {
  const active = entries.filter((e) => now - new Date(e.ts).getTime() < WEEK_MS);
  const featureEntries = active.filter((e) => e.feature === feature);
  return { active, featureEntries };
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

export const aiDevMock = {
  async getUsage(): Promise<AiUsageSummary> {
    const userId = currentUserId();
    const { limits, hasOverride } = readEffectiveLimits(userId);
    const entries = readJson<AiUsageEntry[]>(usageKey(userId), []);
    const now = Date.now();
    const features = (Object.keys(AI_FEATURES) as AiFeatureId[]).map((f) =>
      buildFeatureUsage(entries, f, limits.perWeek[f] ?? 0, now),
    );
    return { features, limits, hasOverride, now: new Date(now).toISOString() };
  },

  async generateCharacterImage(input: { prompt: string; style: AiImageStyle | null; referenceImageUrl?: string; iterateImageUrl?: string }): Promise<{ url: string; usage: AiUsageSummary }> {
    const userId = currentUserId();
    const { limits } = readEffectiveLimits(userId);
    const limit = limits.perWeek.character_image ?? 0;
    const now = Date.now();

    const entries = readJson<AiUsageEntry[]>(usageKey(userId), []);
    const { active, featureEntries } = pruneAndCount(entries, 'character_image', now);
    if (featureEntries.length >= limit) {
      throw new Error('Quota IA atteint pour cette semaine');
    }

    // Si VITE_FAL_KEY est définie en local, on appelle fal.ai pour de vrai
    // (même en dev). Sinon, image placeholder déterministe.
    const falKey = import.meta.env.VITE_FAL_KEY as string | undefined;
    const falModel = (import.meta.env.VITE_FAL_IMAGE_MODEL as string | undefined) ?? 'fal-ai/flux/dev';
    const falImg2ImgModel = (import.meta.env.VITE_FAL_IMG2IMG_MODEL as string | undefined) ?? 'fal-ai/flux/dev/image-to-image';
    const falVisionModel = (import.meta.env.VITE_FAL_VISION_MODEL as string | undefined) ?? 'fal-ai/llavav15-13b';
    // Modèles par style — flux-pro/v1.1 pour les rendus photo, flux/dev pour l'illustration.
    // Override possible via env si tu veux tester d'autres modèles.
    const styleModelDefault: Record<AiImageStyle, string> = {
      realistic: 'fal-ai/flux-pro/v1.1',
      cinematic: 'fal-ai/flux-pro/v1.1',
      painterly: 'fal-ai/flux/dev',
      anime: 'fal-ai/flux/dev',
      cartoon: 'fal-ai/flux/dev',
      sketch: 'fal-ai/flux/dev',
    };
    const styleEnvOverride: Partial<Record<AiImageStyle, string | undefined>> = {
      realistic: import.meta.env.VITE_FAL_REALISTIC_MODEL as string | undefined,
      cinematic: import.meta.env.VITE_FAL_CINEMATIC_MODEL as string | undefined,
    };

    let url: string;
    if (falKey) {
      const useReference = !!input.referenceImageUrl;
      const useIterate = !!input.iterateImageUrl && !useReference;

      // Pipeline 2-passes pour la référence : vision LLM extrait le style,
      // puis génération normale avec le style injecté en texte.
      let prompt = input.prompt;
      if (useReference && input.referenceImageUrl) {
        try {
          const visionRes = await fetch(`https://fal.run/${falVisionModel}`, {
            method: 'POST',
            headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_url: input.referenceImageUrl,
              prompt:
                "Describe ONLY the visual style of this image — medium (photo, oil painting, watercolor, ink, pencil sketch, 3D render, anime, etc.), color palette, lighting quality, mood/atmosphere, composition style, level of detail. Do NOT describe the subject (no mention of people, age, gender, clothing, objects, what is shown). Start your reply directly with the style description, no preamble. Stay under 60 words.",
              max_tokens: 200,
            }),
          });
          if (visionRes.ok) {
            const data = await visionRes.json() as { output?: string; response?: string; text?: string };
            const styleDesc = (data.output ?? data.response ?? data.text ?? '').trim();
            if (styleDesc) prompt = `${prompt}. Reproduce this exact visual style faithfully: ${styleDesc}`;
          } else {
            console.warn('[ai] Vision describer failed, falling back to prompt only');
          }
        } catch (err) {
          console.warn('[ai] Vision describer error:', err);
        }
      }

      const styleEndpoint = input.style
        ? (styleEnvOverride[input.style] ?? styleModelDefault[input.style])
        : falModel;
      const endpoint = useIterate ? falImg2ImgModel : styleEndpoint;
      const body: Record<string, unknown> = {
        prompt,
        image_size: 'square_hd',
        num_images: 1,
        enable_safety_checker: true,
      };
      if (useIterate) {
        body.image_url = input.iterateImageUrl;
        body.strength = 0.7;
      }

      const res = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`fal.ai HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { images?: Array<{ url: string }> };
      const first = data.images?.[0]?.url;
      if (!first) throw new Error('fal.ai: réponse sans image');
      url = first;
    } else {
      await new Promise((r) => setTimeout(r, 600));
      const seed = input.prompt.split(/\s+/).slice(0, 3).join('-').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'character';
      url = `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    }

    const newEntry: AiUsageEntry = { feature: 'character_image', ts: new Date(now).toISOString() };
    writeJson(usageKey(userId), [...active, newEntry]);

    return { url, usage: await aiDevMock.getUsage() };
  },

  // Admin-side helpers
  async adminGetUserUsage(userId: string): Promise<AiUsageSummary> {
    const { limits, hasOverride } = readEffectiveLimits(userId);
    const entries = readJson<AiUsageEntry[]>(usageKey(userId), []);
    const now = Date.now();
    const features = (Object.keys(AI_FEATURES) as AiFeatureId[]).map((f) =>
      buildFeatureUsage(entries, f, limits.perWeek[f] ?? 0, now),
    );
    return { features, limits, hasOverride, now: new Date(now).toISOString() };
  },

  async adminSetUserLimits(userId: string, limits: AiLimits | null): Promise<void> {
    if (limits === null) localStorage.removeItem(userLimitsKey(userId));
    else writeJson(userLimitsKey(userId), limits);
  },

  async adminGetUserDetail(userId: string): Promise<{
    user: { id: string; email: string; name: string; isAdmin: boolean; createdAt: string };
    booksCount: number;
    usage: AiUsageSummary;
  }> {
    const u = devAuth.listUsers().find((x) => x.id === userId);
    if (!u) throw new Error('Utilisateur introuvable');
    const books = readJson<unknown[]>(`emlb-dev:u:${userId}:library`, []);
    const usage = await aiDevMock.adminGetUserUsage(userId);
    return {
      user: { id: u.id, email: u.email, name: u.name, isAdmin: u.isAdmin, createdAt: u.createdAt },
      booksCount: books.length,
      usage,
    };
  },
};
