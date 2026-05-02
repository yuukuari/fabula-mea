// Scrape synonymes / antonymes depuis CNRTL avec cache mémoire LRU simple.
// Partagé entre le menu contextuel du correcteur et le panneau Aide à l'écriture.

const cache = new Map<string, string[]>();
const MAX_CACHE = 200;

export type CnrtlType = 'synonymie' | 'antonymie';

export async function fetchCnrtl(type: CnrtlType, word: string): Promise<string[]> {
  const key = `${type}:${word.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`https://www.cnrtl.fr/${type}/${encodeURIComponent(word)}`);
    if (!res.ok) return [];
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const allLinks = doc.querySelectorAll('td a');
    const words = Array.from(allLinks)
      .map((a) => (a as HTMLAnchorElement).textContent?.trim() ?? '')
      .filter((w) => w && !w.includes(',') && w.length > 1 && w.length < 30);
    cache.set(key, words);
    if (cache.size > MAX_CACHE) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    return words;
  } catch {
    return [];
  }
}
