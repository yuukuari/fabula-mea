/**
 * Provider IA — wrapper isolé pour fal.ai (image).
 *
 * Pour ajouter un autre provider (ex. Replicate, OpenAI Images), créer un
 * second module et router en fonction d'une variable d'environnement.
 *
 * Variables d'environnement :
 *   FAL_KEY              — clé API fal.ai (obligatoire en prod)
 *   FAL_IMAGE_MODEL      — modèle text-to-image (default: 'fal-ai/flux/dev')
 *   FAL_IMG2IMG_MODEL    — modèle d'affinage img2img (default: 'fal-ai/flux/dev/image-to-image')
 *   FAL_VISION_MODEL     — vision LLM pour extraire le style d'une image de référence
 *                          (default: 'fal-ai/llavav15-13b')
 *   FAL_REALISTIC_MODEL  — override pour le style 'realistic' (recommandé pour photoréalisme)
 *   FAL_CINEMATIC_MODEL  — override pour le style 'cinematic'
 */

const DEFAULT_MODEL = 'fal-ai/flux/dev';
const DEFAULT_IMG2IMG_MODEL = 'fal-ai/flux/dev/image-to-image';
const DEFAULT_VISION_MODEL = 'fal-ai/llavav15-13b';

const STYLE_EXTRACTION_PROMPT =
  "Describe ONLY the visual style of this image — medium (photo, oil painting, watercolor, ink, pencil sketch, 3D render, anime, etc.), color palette, lighting quality, mood/atmosphere, composition style, level of detail. Do NOT describe the subject (no mention of people, age, gender, clothing, objects, what is shown). Start your reply directly with the style description, no preamble. Stay under 60 words.";

export type FalStyleId = 'realistic' | 'cinematic' | 'painterly' | 'anime' | 'cartoon' | 'sketch';

/**
 * Modèles par défaut, par style. Les styles photo utilisent `flux-pro/v1.1`
 * (bien meilleur en photoréalisme), les styles illustrés gardent `flux/dev`.
 * Override possible via env vars (FAL_REALISTIC_MODEL, etc.).
 */
const STYLE_DEFAULTS: Record<FalStyleId, string> = {
  realistic: 'fal-ai/flux-pro/v1.1',
  cinematic: 'fal-ai/flux-pro/v1.1',
  painterly: 'fal-ai/flux/dev',
  anime: 'fal-ai/flux/dev',
  cartoon: 'fal-ai/flux/dev',
  sketch: 'fal-ai/flux/dev',
};

export interface FalImageInput {
  prompt: string;
  imageSize?: 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9';
  numImages?: number;
  /** URL publique d'une image de référence (active le mode Redux pour la cohérence de style). */
  referenceImageUrl?: string;
  /** URL d'une image existante à affiner (active le mode img2img). Exclusif avec referenceImageUrl. */
  iterateImageUrl?: string;
  /** Style choisi côté client — permet de router vers un modèle dédié. */
  style?: FalStyleId | null;
}

export interface FalImageOutput {
  url: string;
  contentType: string;
  width?: number;
  height?: number;
  /** true si fal a déclenché son safety checker (image renvoyée mais noircie). */
  nsfw?: boolean;
}

/**
 * Extrait une description du style visuel d'une image via vision LLM.
 * Utilisé pour le mode "Image de référence" : on ne peut pas faire de vrai
 * style transfer fiable sur fal, donc on transcrit le style en texte puis on
 * génère normalement avec ce texte injecté dans le prompt.
 */
async function describeImageStyle(imageUrl: string): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY manquante');
  const model = process.env.FAL_VISION_MODEL ?? DEFAULT_VISION_MODEL;
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, prompt: STYLE_EXTRACTION_PROMPT, max_tokens: 200 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Vision describer HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { output?: string; response?: string; text?: string };
  const out = (data.output ?? data.response ?? data.text ?? '').trim();
  if (!out) throw new Error('Vision describer: réponse vide');
  return out;
}

export async function falGenerateImage(input: FalImageInput): Promise<FalImageOutput> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('Provider IA non configuré (FAL_KEY manquante)');

  const useReference = !!input.referenceImageUrl;
  const useIterate = !!input.iterateImageUrl && !useReference;

  // Pipeline 2-passes pour le mode référence : vision LLM extrait le style,
  // puis text-to-image standard avec le style injecté dans le prompt.
  let prompt = input.prompt;
  if (useReference && input.referenceImageUrl) {
    try {
      const styleDesc = await describeImageStyle(input.referenceImageUrl);
      prompt = `${prompt}. Reproduce this exact visual style faithfully: ${styleDesc}`;
    } catch (err) {
      console.error('[ai] Vision style extraction failed, generating without:', err);
    }
  }

  const styleEnvOverride = input.style === 'realistic'
    ? process.env.FAL_REALISTIC_MODEL
    : input.style === 'cinematic'
      ? process.env.FAL_CINEMATIC_MODEL
      : undefined;
  const styleDefault = input.style ? STYLE_DEFAULTS[input.style] : undefined;
  const model = useIterate
    ? (process.env.FAL_IMG2IMG_MODEL ?? DEFAULT_IMG2IMG_MODEL)
    : (styleEnvOverride ?? styleDefault ?? process.env.FAL_IMAGE_MODEL ?? DEFAULT_MODEL);
  const url = `https://fal.run/${model}`;

  const body: Record<string, unknown> = {
    prompt,
    image_size: input.imageSize ?? 'square_hd',
    num_images: input.numImages ?? 1,
    enable_safety_checker: true,
  };
  if (useIterate) {
    body.image_url = input.iterateImageUrl;
    body.strength = 0.7;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fal.ai HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    images?: Array<{ url: string; content_type: string; width?: number; height?: number }>;
    has_nsfw_concepts?: boolean[];
  };
  const first = data.images?.[0];
  if (!first?.url) throw new Error('fal.ai: réponse sans image');
  const nsfw = Array.isArray(data.has_nsfw_concepts) ? !!data.has_nsfw_concepts[0] : false;

  return {
    url: first.url,
    contentType: first.content_type ?? 'image/jpeg',
    width: first.width,
    height: first.height,
    nsfw,
  };
}
