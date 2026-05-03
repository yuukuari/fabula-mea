import type { TrimSizeId, PaperType, PrintMargins, PrintEdition, BookLayout, BookFont } from '@/types';
import { DEFAULT_LAYOUT, FONT_WIDTH_FACTOR } from './fonts';

// ─── Trim Sizes ───

export interface TrimSizeInfo {
  id: TrimSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
  description: string;
  /** When true: French/European classic. Otherwise: foreign / less common. */
  classic: boolean;
}

export const TRIM_SIZES: TrimSizeInfo[] = [
  // ─── Classiques (édition française) ───
  { id: 'poche', widthMm: 108, heightMm: 178, label: 'Poche', description: 'Folio, J\'ai lu, 10/18, Pocket', classic: true },
  { id: 'roman', widthMm: 140, heightMm: 205, label: 'Roman', description: 'Format standard du roman français', classic: true },
  { id: 'grand_format', widthMm: 155, heightMm: 240, label: 'Grand format', description: 'Beau livre, hardcover français', classic: true },
  { id: 'a5', widthMm: 148, heightMm: 210, label: 'A5', description: 'Standard européen', classic: true },
  // ─── Autres formats (étrangers ou moins courants) ───
  { id: '6x9', widthMm: 152, heightMm: 229, label: '6×9', description: 'Trade US', classic: false },
  { id: 'royal', widthMm: 156, heightMm: 234, label: 'Royal', description: 'Royal britannique', classic: false },
  { id: 'digest', widthMm: 140, heightMm: 216, label: 'Digest', description: 'Demi-lettre US', classic: false },
];

export function getTrimSize(id: TrimSizeId): TrimSizeInfo {
  return TRIM_SIZES.find((t) => t.id === id)!;
}

// ─── Paper Types ───

export interface PaperTypeInfo {
  id: PaperType;
  label: string;
  thicknessMm: number;
  color: string;
}

// Paper thicknesses in mm *per feuille* (2 pages recto-verso). Aligned with
// Amazon KDP / IngramSpark formulas: white 80g ≈ 0.0572 mm/page (→ 0.1144/feuille),
// cream 80g ≈ 0.0635 mm/page (→ 0.127/feuille), white 90g ≈ 0.065 mm/page.
// Note: reality varies ±10% by supplier and binding thickness — always treat
// the resulting spine width as an approximation, not a print-ready value.
export const PAPER_TYPES: PaperTypeInfo[] = [
  { id: 'white_80', label: 'Blanc 80 g/m²', thicknessMm: 0.1144, color: '#ffffff' },
  { id: 'cream_80', label: 'Crème 80 g/m²', thicknessMm: 0.127, color: '#f5f0e6' },
  { id: 'white_90', label: 'Blanc 90 g/m²', thicknessMm: 0.130, color: '#fafafa' },
];

/** Spine width is an approximation — real thickness depends on binding / glue / cover. */
export const SPINE_WIDTH_TOLERANCE = '±10 %';

export function getPaperType(id: PaperType): PaperTypeInfo {
  return PAPER_TYPES.find((p) => p.id === id)!;
}

// ─── Default Margins per Trim Size ───

export const DEFAULT_MARGINS: Record<TrimSizeId, PrintMargins> = {
  poche:        { topMm: 10, bottomMm: 14, innerMm: 15, outerMm: 10 },
  roman:        { topMm: 12, bottomMm: 17, innerMm: 17, outerMm: 13 },
  grand_format: { topMm: 14, bottomMm: 19, innerMm: 19, outerMm: 15 },
  a5:           { topMm: 12, bottomMm: 18, innerMm: 18, outerMm: 15 },
  '6x9':        { topMm: 13, bottomMm: 19, innerMm: 19, outerMm: 15 },
  royal:        { topMm: 14, bottomMm: 20, innerMm: 20, outerMm: 16 },
  digest:       { topMm: 12, bottomMm: 17, innerMm: 17, outerMm: 14 },
};

export const DEFAULT_BLEED_MM = 3;

export const DEFAULT_PRINT_EDITION: PrintEdition = {
  trimSize: 'roman',
  paperType: 'white_80',
  margins: DEFAULT_MARGINS.roman,
  bleedMm: DEFAULT_BLEED_MM,
};

// ─── Page Count Estimation ───

/**
 * Estimate the number of pages for a given word count and format.
 * Returns an even number (print signatures require even page count).
 */
export function estimatePageCount(
  wordCount: number,
  trimSizeId: TrimSizeId,
  fontSize: number,
  lineHeight: number,
  margins: PrintMargins,
  chapterCount: number,
): number {
  const trim = getTrimSize(trimSizeId);
  const usableWidthMm = trim.widthMm - margins.innerMm - margins.outerMm;
  const usableHeightMm = trim.heightMm - margins.topMm - margins.bottomMm;

  // Convert font size from pt to mm (1pt = 0.3528mm)
  const fontSizeMm = fontSize * 0.3528;
  const lineHeightMm = fontSizeMm * lineHeight;

  const linesPerPage = Math.floor(usableHeightMm / lineHeightMm);
  // Average character width ≈ 0.5 × font size for serif fonts
  const charsPerLine = Math.floor(usableWidthMm / (fontSizeMm * 0.5));
  // French average word length ≈ 5.5 characters (including space)
  const wordsPerLine = charsPerLine / 5.5;
  const wordsPerPage = Math.max(1, Math.floor(linesPerPage * wordsPerLine));

  let pages = Math.ceil(wordCount / wordsPerPage);
  // Add ~2 pages per chapter for headings/breaks
  pages += chapterCount * 2;
  // Fixed pages: title, copyright, TOC, half-title, blank verso
  pages += 6;
  // Round up to even
  if (pages % 2 !== 0) pages += 1;
  return Math.max(2, pages);
}

// ─── Spine Width ───

/** Calculate spine width in mm from page count and paper type */
export function calculateSpineWidth(pageCount: number, paperType: PaperType): number {
  const paper = getPaperType(paperType);
  // Each physical sheet has 2 pages (recto + verso)
  return Math.round(((pageCount / 2) * paper.thicknessMm) * 10) / 10;
}

// ─── Cover Dimensions ───

export interface CoverDimensions {
  totalWidthMm: number;
  totalHeightMm: number;
  spineWidthMm: number;
  frontWidthMm: number;
  backWidthMm: number;
  bleedMm: number;
}

/** Calculate full cover dimensions (flat cover: back + spine + front + bleeds) */
export function calculateCoverDimensions(
  trimSizeId: TrimSizeId,
  pageCount: number,
  paperType: PaperType,
  bleedMm: number,
): CoverDimensions {
  const trim = getTrimSize(trimSizeId);
  const spineWidthMm = calculateSpineWidth(pageCount, paperType);
  const frontWidthMm = trim.widthMm;
  const backWidthMm = trim.widthMm;

  return {
    totalWidthMm: Math.round((bleedMm + backWidthMm + spineWidthMm + frontWidthMm + bleedMm) * 10) / 10,
    totalHeightMm: Math.round((trim.heightMm + 2 * bleedMm) * 10) / 10,
    spineWidthMm,
    frontWidthMm,
    backWidthMm,
    bleedMm,
  };
}

// ─── Content Pagination for Preview ───

export interface BookPageData {
  html: string;
  pageNumber: number;
  isCover?: 'front' | 'back';
  isTitlePage?: boolean;
}

/**
 * Estimate how many characters fit on one page for the given format.
 */
interface PageMetrics {
  /** Lines available per page once all margins are accounted for. */
  linesPerPage: number;
  /** Characters fitting on one line (justified average). */
  charsPerLine: number;
}

function getPageMetrics(
  trimSizeId: TrimSizeId,
  fontSize: number,
  lineHeight: number,
  margins: PrintMargins,
  fontFamily: BookFont,
): PageMetrics {
  const trim = getTrimSize(trimSizeId);
  const usableWidthMm = trim.widthMm - margins.innerMm - margins.outerMm;
  const usableHeightMm = trim.heightMm - margins.topMm - margins.bottomMm;
  const fontSizeMm = fontSize * 0.3528;
  const lineHeightMm = fontSizeMm * lineHeight;
  const linesPerPage = Math.floor(usableHeightMm / lineHeightMm);
  // Per-font width factor accounts for varying glyph density between serif
  // families (Garamond is narrow, Merriweather wide). Falls back to 0.45 for
  // unknown fonts.
  const widthFactor = FONT_WIDTH_FACTOR[fontFamily] ?? 0.45;
  const charsPerLine = Math.max(20, Math.floor(usableWidthMm / (fontSizeMm * widthFactor)));
  return { linesPerPage, charsPerLine };
}

/** Strip HTML tags to get approximate text length */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos);/g, 'X')
    .replace(/&#\d+;/g, 'X')
    .replace(/&[a-z]+;/gi, 'X');
}

/**
 * Estimate the visual lines a single block (`<p>`, `<h2>`, …) consumes.
 *
 * Assumes the renderer applies the normalized CSS injected by `BookReader`
 * (p margin-bottom 0.4em ≈ 0.27 lh, headings line-height 1.2 + small margins).
 * Without that normalization, browser defaults add 1em margins around every
 * block and the math here is wildly off.
 *
 * - Per-block trailing margin: ~0.27 lh (0.4em over 1.5em parent line-height)
 * - Headings actually fit in slightly LESS than one parent line (their own
 *   line-height is 1.2 < parent's 1.5), so no heading bonus.
 * - Scene break (`* * *`) keeps its inline 1em margin top + bottom for
 *   visual breathing room.
 */
function blockLineCost(html: string, charsPerLine: number): number {
  const text = stripHtml(html).trim();
  const isSceneBreak = /\* \* \*/.test(text) && /text-align:center/i.test(html);
  const wrappedLines = Math.max(1, Math.ceil(text.length / charsPerLine));
  let extra = 0.3;
  if (isSceneBreak) extra += 0.8;
  return wrappedLines + extra;
}

/** Split a `<p>...</p>` HTML string at the latest word boundary that keeps
 *  the first part within `maxTextChars` characters. Returns `null` if the
 *  block can't be split (e.g. a heading, a too-short paragraph, or unmatched
 *  tags). Inline tags (`<em>`, `<strong>`, …) open in the first part are
 *  closed and re-opened in the second part to keep both fragments valid. */
function splitParagraphAtChars(html: string, maxTextChars: number): [string, string] | null {
  const m = html.match(/^(\s*)(<(p|blockquote)(?:\s+[^>]*)?>)([\s\S]*)(<\/\3>)(\s*)$/i);
  if (!m) return null;
  const leading = m[1];
  const openTag = m[2];
  const inner = m[4];
  const closeTag = m[5];
  const trailing = m[6];

  let textCount = 0;
  let i = 0;
  const stack: string[] = [];
  let bestBreakIdx = -1;
  let bestBreakStack: string[] = [];

  while (i < inner.length) {
    const ch = inner[i];
    if (ch === '<') {
      const selfClose = inner.slice(i).match(/^<(\w+)(\s[^>]*)?\/>/);
      if (selfClose) { i += selfClose[0].length; continue; }
      const closeMatch = inner.slice(i).match(/^<\/(\w+)\s*>/);
      if (closeMatch) {
        const name = closeMatch[1].toLowerCase();
        const top = stack[stack.length - 1];
        if (top === name) stack.pop();
        i += closeMatch[0].length;
        continue;
      }
      const openMatch = inner.slice(i).match(/^<(\w+)(\s[^>]*)?>/);
      if (openMatch) {
        stack.push(openMatch[1].toLowerCase());
        i += openMatch[0].length;
        continue;
      }
      i++;
      continue;
    }

    // Entity (counts as one character).
    if (ch === '&') {
      const ent = inner.slice(i).match(/^&(?:#\d+|#x[\da-f]+|\w+);/i);
      if (ent) { textCount++; i += ent[0].length; continue; }
    }

    if (/\s/.test(ch) && textCount > 0 && textCount <= maxTextChars) {
      bestBreakIdx = i;
      bestBreakStack = [...stack];
    }

    textCount++;

    if (textCount > maxTextChars && bestBreakIdx >= 0) {
      const cutAt = bestBreakIdx;
      let firstInner = inner.slice(0, cutAt);
      // Skip the whitespace at cutAt.
      let secondInner = inner.slice(cutAt + 1);
      // Close open tags in the first part.
      for (let j = bestBreakStack.length - 1; j >= 0; j--) {
        firstInner += `</${bestBreakStack[j]}>`;
      }
      // Reopen them in the second part.
      let prefix = '';
      for (const t of bestBreakStack) prefix += `<${t}>`;
      secondInner = prefix + secondInner;
      // Drop empty paragraphs.
      if (!stripHtml(firstInner).trim()) return null;
      if (!stripHtml(secondInner).trim()) return null;
      return [
        leading + openTag + firstInner + closeTag,
        openTag + secondInner + closeTag + trailing,
      ];
    }
    i++;
  }
  return null;
}

/** Top-level block boundaries in a chapter HTML stream. */
function splitIntoBlocks(html: string): string[] {
  return html.split(/(?=<(?:p|h[1-6]|blockquote|ul|ol|hr)[\s/>])/i).filter((b) => b.trim().length > 0);
}

/**
 * Pack chapter HTML into pages line by line, splitting paragraphs at word
 * boundaries when they don't fit. Real ebook readers and PDF generators do
 * this — the bottom of every page lands close to the bottom margin, instead
 * of leaving big gaps when paragraphs don't quite fit.
 */
function packHtmlIntoPages(html: string, metrics: PageMetrics): string[] {
  if (!html || !html.trim()) return [];
  const lineBudget = Math.max(4, metrics.linesPerPage);
  const blocks = splitIntoBlocks(html);
  const pages: string[] = [];
  let currentHtml = '';
  let usedLines = 0;

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const cost = blockLineCost(block, metrics.charsPerLine);
    const remaining = lineBudget - usedLines;

    if (cost <= remaining || (usedLines === 0 && cost <= lineBudget)) {
      currentHtml += block;
      usedLines += cost;
      i++;
      continue;
    }

    // Try to split a paragraph mid-way to fill the rest of the page.
    if (remaining >= 2 && /^<p[\s>]/i.test(block.trim())) {
      // Allow up to `remaining` lines on this page (with a small 0.95 safety
      // factor on character count, since wrapping is approximate).
      const maxChars = Math.floor(remaining * metrics.charsPerLine * 0.95);
      const split = splitParagraphAtChars(block, maxChars);
      if (split) {
        currentHtml += split[0];
        pages.push(currentHtml);
        currentHtml = '';
        usedLines = 0;
        blocks[i] = split[1];
        continue;
      }
    }

    // Couldn't split — flush the current page and place this block fresh.
    if (currentHtml) {
      pages.push(currentHtml);
      currentHtml = '';
      usedLines = 0;
    }
    currentHtml += block;
    usedLines += cost;
    i++;
  }

  if (currentHtml.trim()) pages.push(currentHtml);
  return pages.length > 0 ? pages : [''];
}

export interface PaginateInput {
  chapters: Array<{
    number: number;
    title: string;
    type?: string;
    scenes: Array<{ title?: string; content?: string }>;
  }>;
  glossary?: Array<{ name: string; description: string }>;
  layout?: BookLayout;
  printEdition?: PrintEdition;
  title: string;
  author: string;
  coverFront?: string;
  coverBack?: string;
}

/**
 * A function that splits a chapter or glossary HTML into per-page HTML strings.
 * BookReader passes a DOM-measured paginator (see `src/lib/paginate-dom.ts`);
 * other callers fall back to the char-count heuristic below.
 */
export type ContentPaginator = (html: string) => string[];

/**
 * Paginate book content into pages for the preview reader.
 *
 * If `paginator` is omitted, falls back to a char-count heuristic
 * (`packHtmlIntoPages`) which is approximate but synchronous and dependency-
 * free. Pass a DOM paginator for pixel-accurate page breaks.
 */
export function paginateContent(input: PaginateInput, paginator?: ContentPaginator): BookPageData[] {
  const pe = input.printEdition ?? DEFAULT_PRINT_EDITION;
  const fontSize = input.layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = input.layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontFamily = input.layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily;
  const metrics = getPageMetrics(pe.trimSize, fontSize, lineHeight, pe.margins, fontFamily);
  const splitPages: ContentPaginator = paginator ?? ((html) => packHtmlIntoPages(html, metrics));
  const pages: BookPageData[] = [];
  let pageNum = 1;

  // Front cover (always — uses image if uploaded, otherwise the cover color)
  pages.push({ html: '', pageNumber: 0, isCover: 'front' });

  // Blank back-of-cover (verso of front cover, left of first inner spread).
  // Without this, the title page would land on the verso (left) side of the
  // first spread, and the spread parity (verso/recto) would be inverted from
  // the standard book layout where odd page numbers are recto (right).
  pages.push({ html: '', pageNumber: 0 });

  // Title page (recto)
  pages.push({ html: '', pageNumber: pageNum++, isTitlePage: true });

  // Blank verso after title
  pages.push({ html: '', pageNumber: pageNum++ });

  // Chapters.
  // - Regular chapter: chapter heading + all scenes concatenated with `* * *`
  //   separators, paginated as a single stream.
  // - Front/back matter: each scene starts on its own page (no `* * *`
  //   separator), like a mini-chapter — title pages, dedications, copyrights,
  //   etc. each get their own page.
  for (const chapter of input.chapters) {
    const isSpecial = chapter.type === 'front_matter' || chapter.type === 'back_matter';

    if (isSpecial) {
      for (const scene of chapter.scenes) {
        const hasContent = !!(scene.content && scene.content.trim());
        const hasTitle = !!(scene.title && scene.title.trim());
        if (!hasContent && !hasTitle) continue;

        let sceneHtml = '';
        if (hasTitle) {
          sceneHtml += `<h2 style="text-align:center;font-size:1.4em;font-weight:bold;margin:0.5em 0 1em;color:#222;">${scene.title}</h2>`;
        }
        if (hasContent) sceneHtml += scene.content!;
        if (!sceneHtml.trim()) continue;

        const htmlPages = splitPages(sceneHtml);
        for (const html of htmlPages) {
          pages.push({ html, pageNumber: pageNum++ });
        }
      }
      continue;
    }

    const label = chapter.title
      ? `Chapitre ${chapter.number} — ${chapter.title}`
      : `Chapitre ${chapter.number}`;
    let chapterHtml = `<h2 style="text-align:center;font-size:1.4em;font-weight:bold;margin:0.5em 0 1em;color:#222;">${label}</h2>`;

    let visibleSceneAdded = false;
    for (const scene of chapter.scenes) {
      const hasContent = !!(scene.content && scene.content.trim());
      const hasTitle = !!(scene.title && scene.title.trim());
      if (!hasContent && !hasTitle) continue;

      if (visibleSceneAdded) {
        chapterHtml += `<p style="text-align:center;color:#888;margin:1em 0;letter-spacing:0.3em;">* * *</p>`;
      }
      if (hasTitle) {
        chapterHtml += `<p style="text-align:center;font-style:italic;margin:0.5em 0 0.8em;color:#444;">${scene.title}</p>`;
      }
      if (hasContent) chapterHtml += scene.content!;
      visibleSceneAdded = true;
    }

    if (!chapterHtml.trim()) continue;
    const htmlPages = splitPages(chapterHtml);
    for (const html of htmlPages) {
      pages.push({ html, pageNumber: pageNum++ });
    }
  }

  // Glossary
  if (input.glossary && input.glossary.length > 0) {
    let glossaryHtml = '<h2 style="text-align:center;margin-bottom:1em;">Glossaire</h2>';
    for (const entry of input.glossary) {
      glossaryHtml += `<p><strong>${entry.name}</strong> — ${entry.description}</p>`;
    }
    const glossaryPages = splitPages(glossaryHtml);
    for (const html of glossaryPages) {
      pages.push({ html, pageNumber: pageNum++ });
    }
  }

  // Pad with a blank verso if needed so the back cover lands alone on the
  // recto (like a real closed book). Page-flip with showCover groups pages
  // into spreads [1,2], [3,4], ...; if the total length before the back cover
  // results in odd parity, the back cover would be paired with the last
  // content page instead of being alone.
  if ((pages.length + 1) % 2 !== 0) {
    pages.push({ html: '', pageNumber: 0 });
  }

  // Back cover (always — uses image if uploaded, otherwise the cover color)
  pages.push({ html: '', pageNumber: 0, isCover: 'back' });

  return pages;
}
