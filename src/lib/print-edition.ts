import type { TrimSizeId, PaperType, PrintMargins, PrintEdition, BookLayout } from '@/types';
import { DEFAULT_LAYOUT } from './fonts';

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
  chapterTitle?: string;
  sceneTitle?: string;
  isCover?: 'front' | 'back';
  isTitlePage?: boolean;
}

/**
 * Estimate how many characters fit on one page for the given format.
 */
function charsPerPage(
  trimSizeId: TrimSizeId,
  fontSize: number,
  lineHeight: number,
  margins: PrintMargins,
): number {
  const trim = getTrimSize(trimSizeId);
  const usableWidthMm = trim.widthMm - margins.innerMm - margins.outerMm;
  const usableHeightMm = trim.heightMm - margins.topMm - margins.bottomMm;
  const fontSizeMm = fontSize * 0.3528;
  const lineHeightMm = fontSizeMm * lineHeight;
  const linesPerPage = Math.floor(usableHeightMm / lineHeightMm);
  const charsPerLine = Math.floor(usableWidthMm / (fontSizeMm * 0.5));
  // The naive `lines × chars` product over-estimates actual capacity because
  // it ignores paragraph spacing, orphan/widow breaks, variable glyph widths,
  // and the fact that most paragraphs don't fill their last line. Apply a
  // conservative safety factor so the preview doesn't clip the last line.
  return Math.max(50, Math.floor(linesPerPage * charsPerLine * 0.88));
}

/** Strip HTML tags to get approximate text length */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

/** Split HTML content into approximate pages by character count */
function splitHtmlIntoPages(html: string, maxChars: number): string[] {
  if (!html || !html.trim()) return [];

  // Split on paragraph boundaries
  const paragraphs = html.split(/(?=<p[\s>])|(?=<h[1-6][\s>])|(?=<blockquote[\s>])/i).filter(Boolean);
  const pages: string[] = [];
  let currentPage = '';
  let currentLen = 0;

  for (const para of paragraphs) {
    const textLen = stripHtml(para).length;
    if (currentLen + textLen > maxChars && currentPage) {
      pages.push(currentPage);
      currentPage = para;
      currentLen = textLen;
    } else {
      currentPage += para;
      currentLen += textLen;
    }
  }
  if (currentPage.trim()) pages.push(currentPage);

  return pages.length > 0 ? pages : [''];
}

export interface PaginateInput {
  chapters: Array<{
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
 * Paginate book content into pages for the preview reader.
 * This is an approximation — not pixel-perfect.
 */
export function paginateContent(input: PaginateInput): BookPageData[] {
  const pe = input.printEdition ?? DEFAULT_PRINT_EDITION;
  const fontSize = input.layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = input.layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const capacity = charsPerPage(pe.trimSize, fontSize, lineHeight, pe.margins);
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

  // Chapters
  for (const chapter of input.chapters) {
    for (const scene of chapter.scenes) {
      const content = scene.content ?? '';
      const htmlPages = splitHtmlIntoPages(content, capacity);

      for (let i = 0; i < htmlPages.length; i++) {
        pages.push({
          html: htmlPages[i],
          pageNumber: pageNum++,
          chapterTitle: i === 0 ? chapter.title : undefined,
          sceneTitle: i === 0 ? scene.title : undefined,
        });
      }
    }
  }

  // Glossary
  if (input.glossary && input.glossary.length > 0) {
    let glossaryHtml = '<h2 style="text-align:center;margin-bottom:1em;">Glossaire</h2>';
    for (const entry of input.glossary) {
      glossaryHtml += `<p><strong>${entry.name}</strong> — ${entry.description}</p>`;
    }
    const glossaryPages = splitHtmlIntoPages(glossaryHtml, capacity);
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
