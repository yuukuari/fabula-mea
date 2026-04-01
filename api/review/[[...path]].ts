import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../_lib/cors';

// This file exists only to handle the bare /api/review path (no token).
// All real routes are handled by api/review/[token]/[[...path]].ts
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  return res.status(400).json({ error: 'Token requis' });
}
