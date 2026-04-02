import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { cors } from './_lib/cors';
import { requireAuth } from './_lib/auth';

/**
 * POST /api/upload
 * Accepts a base64 data URL in the body and uploads it to Vercel Blob.
 * Returns { url: string } — the public CDN URL of the uploaded image.
 *
 * Body: { dataUrl: string, filename?: string }
 */
module.exports = async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const { dataUrl, filename } = req.body ?? {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'Missing dataUrl' });
  }

  // Parse base64 data URL: data:<mime>;base64,<data>
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid data URL format' });
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : mimeType === 'image/webp' ? 'webp' : 'jpg';

  // Convert base64 to Buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Generate a unique filename
  const safeName = (filename ?? 'image').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  const uniqueName = `${user.userId}/${safeName}-${Date.now()}.${ext}`;

  try {
    const blob = await put(uniqueName, buffer, {
      access: 'public',
      contentType: mimeType,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err: unknown) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
};
