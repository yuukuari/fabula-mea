import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { cors } from '../_lib/cors';
import { requireAuth } from '../_lib/auth';
import { getPathSegments } from '../_lib/utils';
import { getUsageSummary, checkAndIncrementUsage, refundLastUsage } from '../_lib/ai-usage';
import { falGenerateImage } from '../_lib/ai-provider';

const ALLOWED_STYLES = ['realistic', 'cinematic', 'painterly', 'anime', 'cartoon', 'sketch'];

async function handleUsage(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const auth = requireAuth(req, res);
  if (!auth) return;
  const summary = await getUsageSummary(auth.userId);
  return res.json(summary);
}

async function handleCharacterImage(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { prompt, style, referenceImageUrl, iterateImageUrl } = req.body as {
    prompt?: string;
    style?: string | null;
    referenceImageUrl?: string;
    iterateImageUrl?: string;
  };
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt requis' });
  }
  if (prompt.length > 4000) {
    return res.status(400).json({ error: 'prompt trop long' });
  }
  if (referenceImageUrl && iterateImageUrl) {
    return res.status(400).json({ error: 'referenceImageUrl et iterateImageUrl mutuellement exclusifs' });
  }
  for (const [name, val] of [['referenceImageUrl', referenceImageUrl], ['iterateImageUrl', iterateImageUrl]] as const) {
    if (val && (typeof val !== 'string' || !/^https:\/\//.test(val))) {
      return res.status(400).json({ error: `${name} invalide (https requis)` });
    }
  }
  // Style requis sauf si on est en mode image (référence ou iterate).
  if (!referenceImageUrl && !iterateImageUrl) {
    if (!style || !ALLOWED_STYLES.includes(style)) {
      return res.status(400).json({ error: 'style invalide' });
    }
  }

  // 1. Vérification du quota + réservation
  let usage: Awaited<ReturnType<typeof checkAndIncrementUsage>>;
  try {
    usage = await checkAndIncrementUsage(auth.userId, 'character_image');
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === 'QUOTA_EXCEEDED') {
      return res.status(429).json({ error: (err as Error).message, code });
    }
    throw err;
  }

  // 2. Génération via fal.ai
  let generated;
  try {
    generated = await falGenerateImage({
      prompt,
      imageSize: 'square_hd',
      referenceImageUrl,
      iterateImageUrl,
      style: (style ?? null) as 'realistic' | 'cinematic' | 'painterly' | 'anime' | 'cartoon' | 'sketch' | null,
    });
  } catch (err) {
    // Échec provider après incrément : on rembourse pour ne pas pénaliser l'utilisateur.
    console.error('[ai] character-image generation failed:', err);
    usage = await refundLastUsage(auth.userId, 'character_image').catch(() => usage);
    return res.status(502).json({ error: 'Génération échouée. Réessayez.', usage });
  }

  // 2.b Image filtrée par le safety checker fal — refund + erreur explicite.
  if (generated.nsfw) {
    usage = await refundLastUsage(auth.userId, 'character_image').catch(() => usage);
    return res.status(422).json({
      error: "L'image a été filtrée par le safety checker. Cela arrive souvent en mode photoréaliste pour les enfants ou sujets sensibles. Essayez un style illustré (Peinture, Anime, Cartoon, Croquis) ou modifiez la description.",
      code: 'NSFW_FILTERED',
      usage,
    });
  }

  // 3. Re-upload vers Vercel Blob (les URLs fal sont éphémères)
  let publicUrl = generated.url;
  try {
    const imgRes = await fetch(generated.url);
    if (imgRes.ok) {
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const ext = generated.contentType.includes('png') ? 'png'
        : generated.contentType.includes('webp') ? 'webp'
        : 'jpg';
      const blob = await put(
        `${auth.userId}/ai-character-${Date.now()}.${ext}`,
        buffer,
        { access: 'public', contentType: generated.contentType },
      );
      publicUrl = blob.url;
    }
  } catch (err) {
    console.error('[ai] blob re-upload failed (using fal URL):', err);
  }

  return res.json({ url: publicUrl, usage });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const segments = getPathSegments(req, '/api/ai');
  const route = segments[0] ?? '';

  switch (route) {
    case 'usage':
      return handleUsage(req, res);
    case 'character-image':
      return handleCharacterImage(req, res);
    default:
      return res.status(404).json({ error: 'Route introuvable' });
  }
}
