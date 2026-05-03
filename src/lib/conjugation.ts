// Conjugaison française via le Wiktionnaire FR (API MediaWiki, CORS ouverte
// avec origin=*). Accepte un infinitif ou une forme conjuguée : si la page
// "Conjugaison:français/<input>" existe, on l'utilise directement ; sinon on
// charge la page du mot et on en extrait le lien vers la page de conjugaison
// du verbe correspondant.

const API = 'https://fr.wiktionary.org/w/api.php';

const cache = new Map<string, ConjugationResult>();
const MAX_CACHE = 50;

export interface ConjugationResult {
  /** Verbe à l'infinitif (toujours rempli quand on a un résultat). */
  infinitive: string;
  /** Saisie utilisateur (en minuscules trim) — affichée si différente de l'infinitif. */
  query: string;
  /** HTML nettoyé des tables de conjugaison, prêt à être rendu via dangerouslySetInnerHTML. */
  html: string;
  /** URL de la page sur le Wiktionnaire pour un lien « voir plus ». */
  sourceUrl: string;
}

async function fetchParsed(title: string): Promise<string | null> {
  const url = `${API}?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text&origin=*&redirects=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;
    return json.parse?.text?.['*'] ?? null;
  } catch {
    return null;
  }
}

/** Cherche dans la page d'un mot conjugué un lien vers sa page de conjugaison. */
function findInfinitiveFromWordPage(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const links = doc.querySelectorAll('a[href*="Conjugaison"]');
  for (const link of Array.from(links)) {
    const href = (link as HTMLAnchorElement).getAttribute('href') ?? '';
    // /wiki/Conjugaison:fran%C3%A7ais/aller
    const m = href.match(/Conjugaison:[^/]+\/([^?#]+)/);
    if (m) {
      try { return decodeURIComponent(m[1]); }
      catch { return m[1]; }
    }
  }
  return null;
}

/** Garde uniquement les tables de conjugaison + titres et neutralise liens, scripts, attributs. */
function sanitizeConjugationHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Suppression des éléments parasites
  doc.querySelectorAll(
    '.mw-editsection, .navbar, script, style, .reference, .references, .noprint, .mw-empty-elt, .toc, #toc, .bandeau-container, link, meta'
  ).forEach((n) => n.remove());

  // Suppression des phonétiques (API = transcription IPA "\a.le\")
  doc.querySelectorAll('span.API, .API, .prononciation, .audiotable').forEach((n) => n.remove());

  // Suppression des paragraphes/notes en tête, AVANT toute table de conjugaison.
  // Le Wiktionnaire FR met parfois des notes (ex. variante canadienne) avant les
  // tables : on s'en débarrasse, on ne garde que les tables de conjugaison.
  const root = doc.querySelector('.mw-parser-output') ?? doc.body;
  const firstTable = root.querySelector('table');
  if (firstTable) {
    const before: Element[] = [];
    for (const child of Array.from(root.children)) {
      if (child === firstTable || child.contains(firstTable)) break;
      before.push(child);
    }
    // On retire les <p>, <dl>, <ul>, <ol> et titres orphelins en tête (notes intro).
    for (const el of before) {
      if (/^(P|DL|UL|OL|H1|H2|H3|H4|H5)$/.test(el.tagName)) el.remove();
    }
  }

  // Aplatir les liens (texte uniquement) — on ne veut pas naviguer en dehors de l'app
  doc.querySelectorAll('a').forEach((a) => {
    const span = doc.createElement('span');
    span.innerHTML = a.innerHTML;
    a.replaceWith(span);
  });

  // Strip tous les attributs sauf `class` et `colspan`/`rowspan` (utiles pour les tables)
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (!['class', 'colspan', 'rowspan'].includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  // Nettoie les fragments de templates non résolus (ex. "{{fr-conj-3-aller}}")
  // dans tous les nœuds texte, et le connecteur "conjugué comme" qui se retrouve
  // orphelin une fois la référence supprimée.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const allTextNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue) allTextNodes.push(node as Text);
    node = walker.nextNode();
  }
  allTextNodes.forEach((n) => {
    let v = n.nodeValue ?? '';
    v = v.replace(/\{\{[^}]+\}\}/g, '');
    v = v.replace(/,?\s*conjugué\s+comme\s*/gi, '');
    if (v !== n.nodeValue) n.nodeValue = v;
  });

  return doc.body.innerHTML;
}

export async function fetchConjugation(input: string): Promise<ConjugationResult | null> {
  const word = input.trim().toLowerCase();
  if (!word) return null;
  const cached = cache.get(word);
  if (cached) return cached;

  let infinitive = word;
  // 1) Tente directement la page de conjugaison (cas d'un infinitif)
  let html = await fetchParsed(`Conjugaison:français/${word}`);

  // 2) Si pas trouvé, charge la page du mot et cherche un lien vers une page de conjugaison
  if (!html) {
    const wordPage = await fetchParsed(word);
    if (wordPage) {
      const inf = findInfinitiveFromWordPage(wordPage);
      if (inf && inf.toLowerCase() !== word) {
        infinitive = inf;
        html = await fetchParsed(`Conjugaison:français/${inf}`);
      }
    }
  }

  if (!html) return null;

  const result: ConjugationResult = {
    infinitive,
    query: word,
    html: sanitizeConjugationHtml(html),
    sourceUrl: `https://fr.wiktionary.org/wiki/Conjugaison:fran%C3%A7ais/${encodeURIComponent(infinitive)}`,
  };
  cache.set(word, result);
  if (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return result;
}
