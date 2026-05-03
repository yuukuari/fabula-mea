/**
 * DOM-based paginator for the BookReader.
 *
 * Lays out chapter HTML in a hidden offscreen element matching the page's
 * usable content area exactly (same width in CSS px, same font, same line
 * height, same `.fm-reader-content` CSS normalization), then walks blocks one
 * by one, splitting paragraphs at the precise word boundary that fits using
 * Range.getBoundingClientRect.
 *
 * Replaces the char-count heuristic (`packHtmlIntoPages`) which systematically
 * underfills pages because it estimates +0.3 line per block — with many short
 * dialogue paragraphs the budget is exhausted long before the page is full.
 *
 * Measurement runs at the actual physical page size (96 CSS DPI). The flip
 * and grid views render the same HTML at smaller scales; since width and
 * font-size scale together, the line wraps are identical at any scale.
 */

const STYLE_ID = 'fm-paginate-host-style';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Mirror exactly what BookReader.tsx injects for `.fm-reader-content`.
  // Keep these two in sync — drift breaks pagination accuracy.
  style.textContent = `
    .fm-paginate-host { position: absolute; left: -10000px; top: 0; visibility: hidden; pointer-events: none; }
    .fm-paginate-host .fm-reader-content > * { margin: 0; }
    .fm-paginate-host .fm-reader-content p,
    .fm-paginate-host .fm-reader-content blockquote,
    .fm-paginate-host .fm-reader-content ul,
    .fm-paginate-host .fm-reader-content ol { margin: 0 0 0.4em; }
    .fm-paginate-host .fm-reader-content h1,
    .fm-paginate-host .fm-reader-content h2,
    .fm-paginate-host .fm-reader-content h3,
    .fm-paginate-host .fm-reader-content h4,
    .fm-paginate-host .fm-reader-content h5,
    .fm-paginate-host .fm-reader-content h6 { margin: 0.3em 0 0.2em; line-height: 1.2; }
    .fm-paginate-host .fm-reader-content > *:first-child { margin-top: 0; }
    .fm-paginate-host .fm-reader-content > *:last-child { margin-bottom: 0; }
  `;
  document.head.appendChild(style);
}

export interface DomPaginatorOptions {
  /** Usable content area width (excluding page margins) in CSS px. */
  widthPx: number;
  /** Usable content area height (excluding page margins) in CSS px. */
  heightPx: number;
  /** CSS font-family stack. */
  fontFamily: string;
  /** Font size in points (matches BookReader's pt unit). */
  fontSizePt: number;
  /** Unitless line-height multiplier. */
  lineHeight: number;
}

export interface DomPaginator {
  paginate: (html: string) => string[];
  destroy: () => void;
}

export function createDomPaginator(opts: DomPaginatorOptions): DomPaginator {
  ensureStyle();
  const host = document.createElement('div');
  host.className = 'fm-paginate-host';
  host.style.width = `${opts.widthPx}px`;

  const content = document.createElement('div');
  content.className = 'fm-reader-content';
  content.style.fontFamily = opts.fontFamily;
  content.style.fontSize = `${opts.fontSizePt}pt`;
  content.style.lineHeight = String(opts.lineHeight);
  content.style.color = '#333';
  content.style.width = '100%';
  host.appendChild(content);
  document.body.appendChild(host);

  function paginate(html: string): string[] {
    if (!html || !html.trim()) return [''];

    const parser = document.createElement('div');
    parser.innerHTML = html;
    const queue: HTMLElement[] = [];
    for (const node of Array.from(parser.childNodes)) {
      if (node.nodeType === 1) queue.push(node as HTMLElement);
    }
    if (queue.length === 0) return [''];

    const pages: string[] = [];
    content.innerHTML = '';

    const flush = () => {
      pages.push(content.innerHTML);
      content.innerHTML = '';
    };

    while (queue.length > 0) {
      const block = queue.shift()!;
      content.appendChild(block);

      // 0.5px slack to absorb sub-pixel rounding.
      if (content.scrollHeight <= opts.heightPx + 0.5) continue;

      // Block makes the page overflow. Try to split it in place.
      if (canSplit(block)) {
        const r = splitBlockToFit(block, content, opts.heightPx);
        if (r.kind === 'fits') continue;
        if (r.kind === 'split') {
          flush();
          queue.unshift(r.rest);
          continue;
        }
        // r.kind === 'cant' falls through.
      }

      // Couldn't split alongside earlier blocks. If there are any, flush them
      // as a page and retry the block on a fresh page (where it has the full
      // budget). When the block was already alone on the page, there's no
      // retry to do — accept the overflow.
      if (content.children.length > 1) {
        content.removeChild(block);
        flush();
        content.appendChild(block);
        if (content.scrollHeight > opts.heightPx + 0.5 && canSplit(block)) {
          const r = splitBlockToFit(block, content, opts.heightPx);
          if (r.kind === 'split') {
            flush();
            queue.unshift(r.rest);
            continue;
          }
          // 'fits' or 'cant' → accept overflow on this page.
        }
      }
    }

    if (content.children.length > 0) flush();
    return pages.length > 0 ? pages : [''];
  }

  function destroy() {
    host.remove();
  }

  return { paginate, destroy };
}

function canSplit(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === 'p' || tag === 'blockquote' || tag === 'li';
}

/**
 * Outcome of trying to fit / split a block on the current page.
 *
 * - `fits`: keep the block on this page despite the `scrollHeight` overflow.
 *   Returned when there's nothing to gain by splitting — typically a
 *   single-line block (no previous line to fall back to) or exact-zero
 *   overflow.
 * - `split`: the block was cut at a word boundary; `rest` holds the leftover
 *   to push onto the next page.
 * - `cant`: nothing useful fits (block's first line already overflows, or
 *   the block has no splittable text).
 */
type SplitResult =
  | { kind: 'fits' }
  | { kind: 'split'; rest: HTMLElement }
  | { kind: 'cant' };

/**
 * Split `block` (currently the last child of `content`) so the part that
 * fits in `heightPx` from the top of `content` stays in place, and the
 * leftover is returned as a new sibling element with the same tag/attributes.
 */
function splitBlockToFit(block: HTMLElement, content: HTMLElement, heightPx: number): SplitResult {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  const totalLen = textNodes.reduce((s, n) => s + n.data.length, 0);
  if (totalLen === 0) return { kind: 'cant' };

  const contentTop = content.getBoundingClientRect().top;
  const budgetBottom = contentTop + heightPx;

  const locate = (off: number): [Text, number] => {
    let acc = 0;
    for (const n of textNodes) {
      if (acc + n.data.length >= off) return [n, off - acc];
      acc += n.data.length;
    }
    const last = textNodes[textNodes.length - 1];
    return [last, last.data.length];
  };

  const bottomAt = (off: number): number => {
    if (off <= 0) return contentTop;
    const [node, local] = locate(off);
    const r = document.createRange();
    r.setStart(textNodes[0], 0);
    r.setEnd(node, local);
    return r.getBoundingClientRect().bottom;
  };

  // Largest off where bottomAt(off) <= budgetBottom.
  let lo = 1, hi = totalLen, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bottomAt(mid) <= budgetBottom + 0.5) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (best === 0) return { kind: 'cant' };

  // `bottomAt` uses Range.getBoundingClientRect, which returns the bottom of
  // the glyph extent — typically 3-4px above the line-BOX bottom, due to the
  // line-leading (half on top, half on bottom) added by `line-height > 1`.
  // So `best >= totalLen` says the glyphs fit, while the actual line box
  // overflows the page and gets clipped by `overflow:hidden` in the renderer.
  // Detect this via scrollHeight (which DOES count the full line-box) and
  // push the last line onto the next page.
  if (best >= totalLen) {
    const overflowPx = content.scrollHeight - heightPx;
    if (overflowPx <= 0) return { kind: 'fits' };

    const lastBottom = bottomAt(totalLen);
    let lo2 = 1, hi2 = totalLen - 1, beforeLast = 0;
    while (lo2 <= hi2) {
      const mid = (lo2 + hi2) >> 1;
      if (bottomAt(mid) < lastBottom - 1) { beforeLast = mid; lo2 = mid + 1; }
      else hi2 = mid - 1;
    }
    if (beforeLast === 0) return { kind: 'fits' }; // single-line block
    best = beforeLast;
  }

  // Walk back to a whitespace boundary.
  const charAt = (i: number): string => {
    let acc = 0;
    for (const n of textNodes) {
      if (acc + n.data.length > i) return n.data[i - acc];
      acc += n.data.length;
    }
    return '';
  };
  let cut = best;
  while (cut > 0 && !/\s/.test(charAt(cut - 1))) cut--;
  if (cut === 0) cut = best;

  const [endNode, endOffset] = locate(cut);

  // Extract everything from (endNode, endOffset) to end of block. Range
  // preserves partial inline ancestors in both halves (em/strong/etc).
  const range = document.createRange();
  range.setStart(endNode, endOffset);
  if (!block.lastChild) return { kind: 'cant' };
  range.setEndAfter(block.lastChild);
  const fragment = range.extractContents();

  const newBlock = block.cloneNode(false) as HTMLElement;
  newBlock.appendChild(fragment);

  const firstText = firstTextNode(newBlock);
  if (firstText) firstText.data = firstText.data.replace(/^\s+/, '');
  const lastText = lastTextNode(block);
  if (lastText) lastText.data = lastText.data.replace(/\s+$/, '');

  if (!block.textContent || !block.textContent.trim()) return { kind: 'cant' };
  if (!newBlock.textContent || !newBlock.textContent.trim()) return { kind: 'cant' };

  return { kind: 'split', rest: newBlock };
}

function firstTextNode(el: HTMLElement): Text | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text | null;
}

function lastTextNode(el: HTMLElement): Text | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) last = walker.currentNode as Text;
  return last;
}
