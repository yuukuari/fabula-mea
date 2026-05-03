/**
 * Helpers ProseMirror partagés par l'extension de surbrillance Aide à
 * l'écriture : recherche brute d'une chaîne dans le doc, avec fallback sur la
 * tête (40 premiers caractères) au cas où l'inline-formatting coupe le texte.
 *
 * Utilisé pour les phrases longues (1ère occurrence) et pour les n-grammes
 * « Tics de langage » (toutes les occurrences, pour la navigation hit-par-hit).
 */
import type { Node as PMNode } from '@tiptap/pm/model';

export type Range = { from: number; to: number };

/** Renvoie la première occurrence de `target` dans le doc, avec fallback tête. */
export function findRangeForText(doc: PMNode, target: string): Range | null {
  const all = findAllRangesForText(doc, target, { fallbackHead: true, max: 1 });
  return all[0] ?? null;
}

interface FindAllOptions {
  /** Si true (défaut), bascule sur la tête (40 chars) si aucun match exact. */
  fallbackHead?: boolean;
  /** Limite optionnelle du nombre d'occurrences retournées. */
  max?: number;
}

/** Toutes les occurrences de `target` dans le doc. */
export function findAllRangesForText(
  doc: PMNode,
  target: string,
  opts: FindAllOptions = {},
): Range[] {
  if (!target) return [];
  const fallbackHead = opts.fallbackHead ?? true;
  const max = opts.max ?? Infinity;

  const found: Range[] = [];
  const collect = (needle: string) => {
    doc.descendants((node, pos) => {
      if (found.length >= max) return false;
      if (!node.isText || !node.text) return;
      const text = node.text;
      let idx = 0;
      while (idx < text.length) {
        const at = text.indexOf(needle, idx);
        if (at === -1) break;
        found.push({ from: pos + at, to: pos + at + needle.length });
        if (found.length >= max) return false;
        idx = at + needle.length;
      }
    });
  };

  collect(target);
  if (found.length > 0) return found;

  if (fallbackHead) {
    const head = target.slice(0, Math.min(40, target.length));
    if (head.length >= 8) collect(head);
  }
  return found;
}
