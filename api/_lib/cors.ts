import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Sets CORS headers and handles preflight OPTIONS requests.
 * Returns true if the request was a preflight (caller should return early).
 */
export function cors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
