/**
 * Façade IA — point d'entrée unique pour toutes les fonctionnalités IA côté client.
 *
 * En dev (`IS_DEV`), tout passe par `aiDevMock` (localStorage + image placeholder).
 * En prod, tout passe par les serverless functions `/api/ai/*` qui parlent
 * aux providers (clé API serveur uniquement).
 *
 * Ajouter une feature : 1) `AI_FEATURES` dans `features.ts`, 2) ici une méthode,
 * 3) endpoint correspondant dans `api/ai/[[...path]].ts`, 4) mock dans `dev-mock.ts`.
 */

import type { AiUsageSummary, AiImageStyle } from '@/types';
import { aiDevMock } from './dev-mock';

const IS_DEV = import.meta.env.DEV;

function getToken(): string | null {
  return localStorage.getItem('emlb-token');
}

async function aiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/ai${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const ai = {
  usage: (): Promise<AiUsageSummary> =>
    IS_DEV ? aiDevMock.getUsage() : aiFetch<AiUsageSummary>('/usage'),

  generateCharacterImage: (input: {
    prompt: string;
    style: AiImageStyle | null;
    /** Active Flux Redux : style transfer depuis l'image. Mutuellement exclusif avec `iterateImageUrl`. */
    referenceImageUrl?: string;
    /** Active img2img : affine l'image existante selon le prompt. Mutuellement exclusif avec `referenceImageUrl`. */
    iterateImageUrl?: string;
  }): Promise<{ url: string; usage: AiUsageSummary }> =>
    IS_DEV
      ? aiDevMock.generateCharacterImage(input)
      : aiFetch<{ url: string; usage: AiUsageSummary }>('/character-image', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
};

export { AI_FEATURES, AI_IMAGE_STYLES, defaultAiLimits } from './features';
export { buildCharacterImagePrompt } from './character-image';
