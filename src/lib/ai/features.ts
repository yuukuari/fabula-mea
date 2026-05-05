/**
 * Registre central des features IA.
 *
 * Une feature = un point d'entrée IA mesurable (consomme un crédit).
 * Toute nouvelle feature doit être déclarée ici ET implémentée côté serveur
 * (api/ai/[[...path]].ts) pour être appelable.
 */

import type { AiFeatureId, AiImageStyle, AiLimits } from '@/types';

export interface AiFeatureDef {
  id: AiFeatureId;
  label: string;
  description: string;
  /** Limite par défaut, sur fenêtre glissante 7 jours. */
  defaultLimit: number;
}

export const AI_FEATURES: Record<AiFeatureId, AiFeatureDef> = {
  character_image: {
    id: 'character_image',
    label: 'Image de personnage',
    description: "Génère une illustration d'un personnage à partir de sa fiche.",
    defaultLimit: 5,
  },
};

export function defaultAiLimits(): AiLimits {
  const perWeek: AiLimits['perWeek'] = {};
  for (const f of Object.values(AI_FEATURES)) {
    perWeek[f.id] = f.defaultLimit;
  }
  return { perWeek };
}

interface AiImageStyleDef {
  id: AiImageStyle;
  label: string;
  /** Phrase d'ouverture du prompt — pose le médium dès le début (Flux pondère le début). */
  lead: string;
  /** Modificateurs à coller en fin de prompt pour renforcer le style. */
  modifiers: string;
  /**
   * Si true, on ignore les indices narratifs (personnalité, genre du livre, synopsis)
   * dans le prompt — ils pullent vers l'illustration narrative.
   */
  visualOnly?: boolean;
  /**
   * Variantes utilisées pour les sujets mineurs (< 18). Les termes "documentaire"
   * (candid, raw photo, snapshot, skin, no makeup) déclenchent les classifiers
   * anti-CSAM côté provider. On garde un rendu photo plausible avec des termes
   * plus neutres.
   */
  minorSafeLead?: string;
  minorSafeModifiers?: string;
}

export const AI_IMAGE_STYLES: AiImageStyleDef[] = [
  {
    id: 'realistic',
    label: 'Réaliste',
    lead: 'Real candid photograph of an actual person, a real human',
    modifiers: 'photograph, raw photo, unedited, shot on iPhone, natural appearance, age-appropriate skin texture, realistic eyes with catchlights, no makeup, no airbrushing, no skin smoothing, no beauty filter, no glamour retouching, no Instagram filter, no soft focus, no plastic skin, snapshot, looks like a real person from a photo, not AI generated, not CGI, not 3D render, not a painting, not an illustration',
    minorSafeLead: 'Photographic portrait',
    minorSafeModifiers: 'photographic style, natural lighting, photographic medium, looks like a real photo, age-appropriate appearance, realistic eyes, not AI generated, not CGI, not 3D render, not a painting, not an illustration',
    visualOnly: true,
  },
  {
    id: 'cinematic',
    label: 'Cinématique',
    lead: 'Cinematic film still photograph of a real person',
    modifiers: 'photograph from a movie, 35mm film grain, anamorphic lens, dramatic lighting, color graded, real human actor, photographic, not an illustration',
    minorSafeLead: 'Cinematic photographic portrait',
    minorSafeModifiers: 'cinematic style, soft dramatic lighting, photographic medium, age-appropriate appearance, not an illustration',
    visualOnly: true,
  },
  {
    id: 'painterly',
    label: 'Peinture',
    lead: 'Oil painting portrait of',
    modifiers: 'classical art style, rich textures, painterly brushstrokes, museum quality',
  },
  {
    id: 'anime',
    label: 'Anime',
    lead: 'Anime portrait of',
    modifiers: 'cel shading, expressive features, vibrant colors, manga inspired',
  },
  {
    id: 'cartoon',
    label: 'Cartoon',
    lead: 'Stylized cartoon portrait of',
    modifiers: 'clean line art, soft shading, friendly proportions, vector-style',
  },
  {
    id: 'sketch',
    label: 'Croquis',
    lead: 'Detailed pencil sketch portrait, fully drawn, filling the entire frame, of',
    modifiers: 'graphite pencil drawing, dense detailed line work, defined facial features, full hatching and cross-hatching, deep shadows and contrast, well-drawn eyes nose mouth, sharp edges, professional sketch artist quality, high resolution, intricate detail, no blur, no soft focus, white paper background',
  },
];

export function imageStyle(style: AiImageStyle): AiImageStyleDef {
  return AI_IMAGE_STYLES.find((s) => s.id === style) ?? AI_IMAGE_STYLES[0];
}
