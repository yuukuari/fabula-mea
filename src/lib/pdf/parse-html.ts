/**
 * Parse TipTap-style HTML into our internal Block representation.
 *
 * We use the browser's DOMParser (this code runs client-side only) to walk
 * the HTML and emit a flat array of blocks. Inline marks (bold/italic/
 * underline) are flattened into runs on each paragraph block.
 */
import type { Block, InlineRun } from './types';

/** Decode common HTML entities into characters. */
function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

interface InlineContext {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function emptyCtx(): InlineContext {
  return { bold: false, italic: false, underline: false };
}

function collectInline(node: Node, ctx: InlineContext, out: InlineRun[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = decode(node.textContent ?? '');
    if (text.length === 0) return;
    out.push({ text, bold: ctx.bold || undefined, italic: ctx.italic || undefined, underline: ctx.underline || undefined });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  let next = ctx;
  if (tag === 'strong' || tag === 'b') next = { ...next, bold: true };
  if (tag === 'em' || tag === 'i') next = { ...next, italic: true };
  if (tag === 'u') next = { ...next, underline: true };
  if (tag === 'br') {
    out.push({ text: '\n' });
    return;
  }
  for (const child of Array.from(el.childNodes)) {
    collectInline(child, next, out);
  }
}

/** Merge adjacent runs with identical formatting (cosmetic compaction). */
function compactRuns(runs: InlineRun[]): InlineRun[] {
  const result: InlineRun[] = [];
  for (const r of runs) {
    const last = result[result.length - 1];
    if (last && !!last.bold === !!r.bold && !!last.italic === !!r.italic && !!last.underline === !!r.underline) {
      last.text += r.text;
    } else {
      result.push({ ...r });
    }
  }
  return result;
}

function alignFromStyle(el: Element): 'left' | 'center' | 'right' | 'justify' | undefined {
  const style = el.getAttribute('style') ?? '';
  const m = style.match(/text-align\s*:\s*(left|center|right|justify)/);
  return m ? (m[1] as 'left' | 'center' | 'right' | 'justify') : undefined;
}

/** Parse a TipTap-style HTML fragment into block list. */
export function parseHtmlBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const blocks: Block[] = [];
  for (const node of Array.from(root.childNodes)) {
    walkBlock(node, blocks);
  }
  return blocks;
}

function walkBlock(node: Node, out: Block[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = decode(node.textContent ?? '').trim();
    if (text) out.push({ kind: 'paragraph', runs: [{ text }], indent: true });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === 'p') {
    const runs: InlineRun[] = [];
    collectInline(el, emptyCtx(), runs);
    const compact = compactRuns(runs);
    if (compact.length === 0 || compact.every((r) => !r.text.trim())) {
      // empty paragraph → small spacer
      out.push({ kind: 'paragraph', runs: [{ text: '' }] });
      return;
    }
    out.push({ kind: 'paragraph', runs: compact, align: alignFromStyle(el), indent: true });
    return;
  }
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    const text = decode(el.textContent ?? '').trim();
    out.push({ kind: 'heading', level: tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3, text, align: alignFromStyle(el) === 'center' ? 'center' : undefined });
    return;
  }
  if (tag === 'hr') {
    out.push({ kind: 'sceneBreak' });
    return;
  }
  if (tag === 'blockquote') {
    const runs: InlineRun[] = [];
    collectInline(el, emptyCtx(), runs);
    out.push({ kind: 'blockquote', runs: compactRuns(runs) });
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    const items: InlineRun[][] = [];
    for (const li of Array.from(el.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      const runs: InlineRun[] = [];
      collectInline(li, emptyCtx(), runs);
      items.push(compactRuns(runs));
    }
    if (items.length > 0) out.push({ kind: 'list', ordered: tag === 'ol', items });
    return;
  }
  // Unknown wrappers: descend into children
  for (const child of Array.from(el.childNodes)) {
    walkBlock(child, out);
  }
}
