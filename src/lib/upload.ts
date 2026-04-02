/**
 * Client-side image upload helper.
 *
 * - In production: uploads the image to Vercel Blob via /api/upload, returns the CDN URL.
 * - In development: returns the base64 data URL as-is (no server needed).
 */

const IS_DEV = import.meta.env.DEV;

/** Returns true if the value is a base64 data URL */
export function isBase64(value: string): boolean {
  return value.startsWith('data:');
}

/** Returns true if the value is an HTTP(S) URL */
export function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * Upload an image (base64 data URL) to the CDN.
 * In dev mode, returns the dataUrl unchanged.
 * In prod mode, uploads to Vercel Blob and returns the public URL.
 */
export async function uploadImage(dataUrl: string, filename?: string): Promise<string> {
  // Already a URL — no need to upload
  if (isUrl(dataUrl)) return dataUrl;

  // Dev mode — keep base64 as-is
  if (IS_DEV) return dataUrl;

  // Prod mode — upload to Vercel Blob
  const token = localStorage.getItem('emlb-token');
  if (!token) {
    // Not authenticated — fallback to base64
    console.warn('uploadImage: no auth token, keeping base64');
    return dataUrl;
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dataUrl, filename }),
  });

  if (!res.ok) {
    console.error('Upload failed, keeping base64:', await res.text());
    return dataUrl;
  }

  const { url } = await res.json() as { url: string };
  return url;
}

/**
 * Upload multiple images in parallel. Returns a map of field→url.
 * Only uploads base64 values; URLs are passed through unchanged.
 */
export async function uploadImages(
  images: Record<string, string | undefined>,
  filenamePrefix?: string
): Promise<Record<string, string | undefined>> {
  const result: Record<string, string | undefined> = {};
  const promises: Promise<void>[] = [];

  for (const [key, value] of Object.entries(images)) {
    if (!value || !isBase64(value)) {
      result[key] = value;
      continue;
    }
    promises.push(
      uploadImage(value, filenamePrefix ? `${filenamePrefix}-${key}` : key).then((url) => {
        result[key] = url;
      })
    );
  }

  await Promise.all(promises);
  return result;
}
