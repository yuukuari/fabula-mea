/**
 * Text layout engine: takes Block[] and a PDFDocument, paints them into
 * pages page-by-page with margin handling, line wrapping, and pagination.
 *
 * Coordinates: pdf-lib uses points (1pt = 1/72 inch). Y axis grows upward
 * from page bottom — we translate from a "top-down" cursor for clarity.
 */
import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import type { Block, InlineRun, AnchorRecord } from './types';
import { FontSet, pickFont, safeText } from './fonts';

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
export const mmToPt = (mm: number): number => (mm / MM_PER_INCH) * PT_PER_INCH;

export interface LayoutMargins {
  topMm: number;
  bottomMm: number;
  innerMm: number;
  outerMm: number;
}

export interface LayoutConfig {
  /** Page trim size in mm. */
  trimWidthMm: number;
  trimHeightMm: number;
  margins: LayoutMargins;
  /** Body font size (pt) and line-height multiplier. */
  fontSize: number;
  lineHeight: number;
  /** When true, alternate inner/outer margins between recto and verso. */
  alternateMargins: boolean;
  /** Show page numbers. */
  showPageNumbers: boolean;
}

interface PageCtx {
  page: PDFPage;
  /** Current cursor in "top-down" mm: 0 = top of page, increases downward. */
  cursorYMm: number;
  /** 0-based page index in this document. */
  pageIndex: number;
}

/** A paginator manages a sequence of pdf-lib pages and a top-down cursor. */
export class Paginator {
  private doc: PDFDocument;
  private fonts: FontSet;
  cfg: LayoutConfig;
  pages: PDFPage[] = [];
  current: PageCtx | null = null;
  /** Map of anchor id → page index, populated by record(). */
  anchors: AnchorRecord[] = [];
  /**
   * Set to a page index when body numbering should start. Pages with
   * pageIndex < bodyStartIndex have no page number; the page numbered "1"
   * is the page at bodyStartIndex.
   * undefined = numbering disabled altogether.
   */
  bodyStartIndex: number | undefined;

  constructor(doc: PDFDocument, fonts: FontSet, cfg: LayoutConfig) {
    this.doc = doc;
    this.fonts = fonts;
    this.cfg = cfg;
  }

  /** Mark the next page added as the start of body numbering ("page 1"). */
  startBodyNumbering(): void {
    this.bodyStartIndex = this.pages.length;
  }

  /** Width and height in points. */
  pageWidthPt(): number { return mmToPt(this.cfg.trimWidthMm); }
  pageHeightPt(): number { return mmToPt(this.cfg.trimHeightMm); }

  /** Returns left/right margins in mm for the given page index. */
  marginsMm(pageIndex: number): { leftMm: number; rightMm: number; topMm: number; bottomMm: number } {
    const { innerMm, outerMm, topMm, bottomMm } = this.cfg.margins;
    if (!this.cfg.alternateMargins) {
      // Same margins for screen mode. Use the average so the text block
      // is the same width as in print mode (visual continuity).
      return { leftMm: innerMm, rightMm: outerMm, topMm, bottomMm };
    }
    // Page 1 (index 0) is recto (right-hand) in standard book layout.
    const isRecto = pageIndex % 2 === 0;
    return isRecto
      ? { leftMm: innerMm, rightMm: outerMm, topMm, bottomMm }
      : { leftMm: outerMm, rightMm: innerMm, topMm, bottomMm };
  }

  /** Usable text width on a given page, in mm. */
  textWidthMm(pageIndex: number): number {
    const m = this.marginsMm(pageIndex);
    return this.cfg.trimWidthMm - m.leftMm - m.rightMm;
  }

  /** Usable text height on a page (excluding bottom area for page number). */
  textHeightMm(pageIndex: number): number {
    const m = this.marginsMm(pageIndex);
    const reservedForPageNum = this.cfg.showPageNumbers ? 6 : 0;
    return this.cfg.trimHeightMm - m.topMm - m.bottomMm - reservedForPageNum;
  }

  /** Start a new page, draw page number when applicable. */
  newPage(): PageCtx {
    const page = this.doc.addPage([this.pageWidthPt(), this.pageHeightPt()]);
    this.pages.push(page);
    const ctx: PageCtx = { page, cursorYMm: this.marginsMm(this.pages.length - 1).topMm, pageIndex: this.pages.length - 1 };
    this.current = ctx;
    if (this.cfg.showPageNumbers
      && this.bodyStartIndex !== undefined
      && ctx.pageIndex >= this.bodyStartIndex) {
      this.drawPageNumber(ctx);
    }
    return ctx;
  }

  /** Add a blank page (for forced recto starts, end-of-document padding). */
  addBlankPage(): void {
    const page = this.doc.addPage([this.pageWidthPt(), this.pageHeightPt()]);
    this.pages.push(page);
    // Don't draw page number on intentionally blank padding pages.
    this.current = null;
  }

  /** Ensure we have a current page; create one if not. */
  ensurePage(): PageCtx {
    if (!this.current) return this.newPage();
    return this.current;
  }

  /** Move cursor to next page, optionally forcing recto. */
  pageBreak(forceRecto: boolean = false): void {
    if (forceRecto && this.cfg.alternateMargins) {
      // After break, next page should be recto (index even).
      // If current count is odd, that means next addition is even (recto). OK.
      // If count is even, next would be index even but that's verso start? No:
      // pages.length is the next page's INDEX. So we want pages.length to be
      // even (next page recto). If pages.length is odd, insert a blank verso.
      if (this.pages.length % 2 === 1) {
        this.addBlankPage();
      }
    }
    this.current = null;
  }

  /** Pad until page count is a multiple of 4 (POD requirement). */
  padToMultipleOf4(): void {
    while (this.pages.length % 4 !== 0) this.addBlankPage();
  }

  /** Record an anchor at the current page. */
  recordAnchor(id: string): void {
    const idx = this.current?.pageIndex ?? this.pages.length; // current or next
    this.anchors.push({ id, pageIndex: idx });
  }

  // ─── Drawing primitives ─────────────────────────────────────────────

  private drawPageNumber(ctx: PageCtx): void {
    const m = this.marginsMm(ctx.pageIndex);
    const start = this.bodyStartIndex ?? 0;
    const label = String(ctx.pageIndex - start + 1);
    const font = this.fonts.sans;
    const size = 9;
    const widthPt = font.widthOfTextAtSize(label, size);
    const xPt = (this.pageWidthPt() - widthPt) / 2;
    // 4mm above bottom edge, in pdf-lib coords (origin bottom-left).
    const yPt = mmToPt(m.bottomMm - 4);
    ctx.page.drawText(label, { x: xPt, y: yPt > 0 ? yPt : mmToPt(4), size, font, color: rgb(0.4, 0.4, 0.4) });
  }

  /** Available vertical space below cursor in mm. */
  availableMm(): number {
    const ctx = this.ensurePage();
    const m = this.marginsMm(ctx.pageIndex);
    const usedFromTop = ctx.cursorYMm - m.topMm;
    return this.textHeightMm(ctx.pageIndex) - usedFromTop;
  }

  /** Convert top-down mm cursor to pdf-lib y (bottom-up pt). */
  yPtAtCursor(extraMm: number = 0): number {
    const ctx = this.ensurePage();
    const yMm = ctx.cursorYMm + extraMm;
    return this.pageHeightPt() - mmToPt(yMm);
  }

  /** Advance the cursor by `mm` mm; if it overflows, start a new page. */
  advance(mm: number): void {
    const ctx = this.ensurePage();
    ctx.cursorYMm += mm;
    const m = this.marginsMm(ctx.pageIndex);
    const limit = this.cfg.trimHeightMm - m.bottomMm - (this.cfg.showPageNumbers ? 6 : 0);
    if (ctx.cursorYMm >= limit) {
      this.current = null;
    }
  }

  // ─── Text rendering ─────────────────────────────────────────────────

  /**
   * Draw a paragraph of inline runs with word-wrap and optional alignment.
   * Returns the height consumed in mm.
   */
  drawParagraph(runs: InlineRun[], opts: {
    align?: 'left' | 'center' | 'right' | 'justify';
    indent?: boolean;
    size?: number;
    font?: PDFFont;
    boldDefault?: boolean;
    italicDefault?: boolean;
    colorRgb?: [number, number, number];
    leftIndentMm?: number;
    spaceAfterMm?: number;
  } = {}): void {
    const size = opts.size ?? this.cfg.fontSize;
    const lineHeightPt = size * this.cfg.lineHeight;
    const lineHeightMm = (lineHeightPt / PT_PER_INCH) * MM_PER_INCH;
    const align = opts.align ?? 'justify';
    const leftIndentMm = opts.leftIndentMm ?? 0;
    const indentFirst = opts.indent && align === 'justify' ? 5 : 0; // 5mm indent for body paragraphs

    // Tokenize runs into "tokens" preserving formatting; spaces are tokens too.
    interface Tok { text: string; font: PDFFont; bold?: boolean; italic?: boolean; underline?: boolean; isSpace: boolean; isNewline: boolean; }
    const tokens: Tok[] = [];
    for (const r of runs) {
      const bold = r.bold || opts.boldDefault;
      const italic = r.italic || opts.italicDefault;
      const underline = r.underline;
      const font = pickFont(this.fonts, bold, italic);
      // Split on whitespace and newlines, keeping them as separators.
      const parts = r.text.split(/(\s+|\n)/);
      for (const part of parts) {
        if (!part) continue;
        if (part === '\n') { tokens.push({ text: '', font, isSpace: false, isNewline: true }); continue; }
        if (/^\s+$/.test(part)) { tokens.push({ text: ' ', font, isSpace: true, isNewline: false }); continue; }
        tokens.push({ text: safeText(part, this.fonts), font, bold, italic, underline, isSpace: false, isNewline: false });
      }
    }

    // Greedy word-wrap into lines.
    interface Line { tokens: Tok[]; widthPt: number; isLastInPara: boolean; firstLine: boolean; }
    const lines: Line[] = [];
    let cur: Tok[] = [];
    let curWidth = 0;
    let firstLine = true;

    const ctx = this.ensurePage();
    const textWidthMm = this.textWidthMm(ctx.pageIndex) - leftIndentMm;
    const widthPt = (mm: number) => mmToPt(mm);
    const flush = (lastInPara: boolean) => {
      // strip trailing spaces
      while (cur.length > 0 && cur[cur.length - 1].isSpace) cur.pop();
      if (cur.length > 0 || lastInPara) {
        lines.push({ tokens: cur, widthPt: cur.reduce((w, t) => w + t.font.widthOfTextAtSize(t.text, size), 0), isLastInPara: lastInPara, firstLine });
      }
      cur = [];
      curWidth = 0;
      firstLine = false;
    };

    const lineMaxPt = (firstLine: boolean) => widthPt(textWidthMm) - (firstLine ? widthPt(indentFirst) : 0);

    for (const t of tokens) {
      if (t.isNewline) { flush(true); firstLine = true; continue; }
      const tw = t.font.widthOfTextAtSize(t.text, size);
      if (cur.length === 0 && t.isSpace) continue; // skip leading spaces
      if (curWidth + tw > lineMaxPt(firstLine) && !t.isSpace) {
        flush(false);
        if (t.isSpace) continue;
      }
      cur.push(t);
      curWidth += tw;
    }
    flush(true);

    // Page-flow: draw each line, paginate when needed.
    for (const line of lines) {
      // Skip empty lines that occur as a result of \n on otherwise-empty input.
      if (line.tokens.length === 0 && line.isLastInPara && lines.length === 1) {
        this.advance(lineHeightMm);
        continue;
      }
      // Need a new page if not enough room.
      if (this.availableMm() < lineHeightMm) {
        this.current = null;
      }
      const ctx2 = this.ensurePage();
      const m = this.marginsMm(ctx2.pageIndex);
      const yPt = this.yPtAtCursor(lineHeightMm * 0.78); // baseline ~78% down the line
      const xLeftPt = mmToPt(m.leftMm + leftIndentMm) + (line.firstLine ? mmToPt(indentFirst) : 0);

      // Compute extra space distribution for justify
      const lineMax = lineMaxPt(line.firstLine);
      const naturalWidth = line.widthPt;
      let extraPerSpace = 0;
      let xPt = xLeftPt;
      if (align === 'right') {
        xPt = mmToPt(this.cfg.trimWidthMm - m.rightMm) - naturalWidth;
      } else if (align === 'center') {
        xPt = xLeftPt + (lineMax - naturalWidth) / 2;
      } else if (align === 'justify' && !line.isLastInPara) {
        const spaces = line.tokens.filter((t) => t.isSpace).length;
        if (spaces > 0 && lineMax > naturalWidth) extraPerSpace = (lineMax - naturalWidth) / spaces;
      }

      // Draw tokens
      for (const t of line.tokens) {
        const tw = t.font.widthOfTextAtSize(t.text, size);
        if (t.text) {
          ctx2.page.drawText(t.text, {
            x: xPt,
            y: yPt,
            size,
            font: t.font,
            color: opts.colorRgb ? rgb(...opts.colorRgb) : rgb(0.1, 0.1, 0.1),
          });
          if (t.underline) {
            ctx2.page.drawLine({
              start: { x: xPt, y: yPt - 1 },
              end: { x: xPt + tw, y: yPt - 1 },
              thickness: 0.5,
              color: opts.colorRgb ? rgb(...opts.colorRgb) : rgb(0.1, 0.1, 0.1),
            });
          }
        }
        xPt += tw + (t.isSpace ? extraPerSpace : 0);
      }

      this.advance(lineHeightMm);
    }

    if (opts.spaceAfterMm) this.advance(opts.spaceAfterMm);
  }

  /** Draw a centered heading; advances cursor. */
  drawHeading(text: string, opts: {
    size: number;
    font?: PDFFont;
    spaceBeforeMm?: number;
    spaceAfterMm?: number;
    align?: 'left' | 'center';
  }): void {
    if (opts.spaceBeforeMm) this.advance(opts.spaceBeforeMm);
    const font = opts.font ?? this.fonts.bold;
    const lineHeightMm = (opts.size * 1.3 / PT_PER_INCH) * MM_PER_INCH;
    if (this.availableMm() < lineHeightMm) this.current = null;
    const ctx = this.ensurePage();
    const m = this.marginsMm(ctx.pageIndex);
    const safe = safeText(text, this.fonts);
    const tw = font.widthOfTextAtSize(safe, opts.size);
    let xPt: number;
    if ((opts.align ?? 'center') === 'center') {
      xPt = mmToPt(m.leftMm) + (mmToPt(this.textWidthMm(ctx.pageIndex)) - tw) / 2;
    } else {
      xPt = mmToPt(m.leftMm);
    }
    const yPt = this.yPtAtCursor(lineHeightMm * 0.78);
    ctx.page.drawText(safe, { x: xPt, y: yPt, size: opts.size, font, color: rgb(0.1, 0.1, 0.1) });
    this.advance(lineHeightMm);
    if (opts.spaceAfterMm) this.advance(opts.spaceAfterMm);
  }

  /** Centered scene break ornament (asterism). */
  drawSceneBreak(): void {
    const lineHeightMm = (this.cfg.fontSize * this.cfg.lineHeight / PT_PER_INCH) * MM_PER_INCH;
    this.advance(lineHeightMm);
    if (this.availableMm() < lineHeightMm * 2) this.current = null;
    const ctx = this.ensurePage();
    const m = this.marginsMm(ctx.pageIndex);
    const text = '* * *';
    const size = this.cfg.fontSize;
    const tw = this.fonts.regular.widthOfTextAtSize(text, size);
    const xPt = mmToPt(m.leftMm) + (mmToPt(this.textWidthMm(ctx.pageIndex)) - tw) / 2;
    const yPt = this.yPtAtCursor(lineHeightMm * 0.78);
    ctx.page.drawText(text, { x: xPt, y: yPt, size, font: this.fonts.regular, color: rgb(0.4, 0.4, 0.4) });
    this.advance(lineHeightMm * 2);
  }
}

export function blockToBlocks(b: Block): Block[] {
  return [b];
}
