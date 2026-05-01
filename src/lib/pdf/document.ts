/**
 * Main orchestrator: builds the full interior PDF (cover, title page,
 * copyright, TOC, chapters, glossary, back cover) from an ExportBook.
 */
import { PDFDocument, rgb } from 'pdf-lib';
import type { ExportBook } from '@/lib/export-shared';
import { getTrimSize } from '@/lib/print-edition';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import { Paginator, mmToPt } from './layout';
import { loadFontSet } from './fonts';
import { parseHtmlBlocks } from './parse-html';
import { drawCoverPage } from './cover';
import type { Block } from './types';

export interface BuildPdfOptions {
  /** When true: alternating margins, blank pages forcing recto, multiple of 4. */
  printMode: boolean;
  /** Include front and back covers as full pages (only meaningful for screen). */
  includeCovers: boolean;
}

/** Human-readable text for a license/rights code. */
function rightsLabel(rights?: string): string | null {
  const map: Record<string, string> = {
    all_rights_reserved: 'Tous droits réservés.',
    cc_by: 'Licence Creative Commons Attribution 4.0 (CC BY 4.0).',
    cc_by_sa: 'Licence Creative Commons Attribution - Partage dans les mêmes conditions 4.0 (CC BY-SA 4.0).',
    cc_by_nc: "Licence Creative Commons Attribution - Pas d'utilisation commerciale 4.0 (CC BY-NC 4.0).",
    cc_by_nc_sa: "Licence Creative Commons Attribution - Pas d'utilisation commerciale - Partage dans les mêmes conditions 4.0 (CC BY-NC-SA 4.0).",
    cc_by_nd: 'Licence Creative Commons Attribution - Pas de modification 4.0 (CC BY-ND 4.0).',
    cc_by_nc_nd: "Licence Creative Commons Attribution - Pas d'utilisation commerciale - Pas de modification 4.0 (CC BY-NC-ND 4.0).",
    public_domain: 'Œuvre placée dans le domaine public.',
  };
  return rights && map[rights] ? map[rights] : null;
}

export async function buildInteriorPdf(book: ExportBook, opts: BuildPdfOptions): Promise<Uint8Array> {
  const layout = book.layout;
  const pe = layout?.printEdition;
  const trim = pe ? getTrimSize(pe.trimSize) : { widthMm: 148, heightMm: 210 };
  const margins = pe?.margins ?? { topMm: 18, bottomMm: 18, innerMm: 18, outerMm: 15 };
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;

  const doc = await PDFDocument.create();
  doc.setTitle(book.title || 'Livre');
  doc.setAuthor(book.author || '');
  if (book.synopsis) doc.setSubject(book.synopsis.slice(0, 500));

  const fonts = await loadFontSet(doc, layout?.fontFamily);
  const paginator = new Paginator(doc, fonts, {
    trimWidthMm: trim.widthMm,
    trimHeightMm: trim.heightMm,
    margins: {
      topMm: margins.topMm ?? 18,
      bottomMm: margins.bottomMm ?? 18,
      innerMm: margins.innerMm ?? 18,
      outerMm: margins.outerMm ?? 15,
    },
    fontSize,
    lineHeight,
    alternateMargins: opts.printMode,
    showPageNumbers: true,
  });

  // ─── 1. Front cover (screen mode only) ───
  if (opts.includeCovers) {
    const frontSrc = book.resolvedCoverFront ?? book.layout?.coverFront;
    if (frontSrc) {
      await drawCoverPage(doc, frontSrc, trim.widthMm, trim.heightMm);
      paginator.pages.push(doc.getPages()[doc.getPageCount() - 1]);
      // The cover page is appended to the doc directly, but we want it to
      // count for paginator's recto/verso calculations. Force `current = null`.
      paginator.current = null;
    }
  }

  // In print mode, force chapters to start in recto. In screen mode,
  // we still want a clean separation.
  const forceRecto = opts.printMode;

  // ─── 2. Title page ───
  paginator.newPage();
  paginator.advance(trim.heightMm * 0.30); // push down ~30% of page
  paginator.drawHeading(book.title || 'Sans titre', { size: 28, font: fonts.bold, align: 'center', spaceAfterMm: 8 });
  if (book.author) {
    paginator.drawParagraph(
      [{ text: book.author, italic: true }],
      { align: 'center', size: 16, spaceAfterMm: 4 },
    );
  }
  if (book.genre) {
    paginator.drawParagraph(
      [{ text: book.genre }],
      { align: 'center', size: 11, colorRgb: [0.5, 0.5, 0.5] },
    );
  }
  paginator.pageBreak(forceRecto);

  // ─── 3. Copyright page (print mode + when meaningful) ───
  if (opts.printMode) {
    paginator.newPage();
    // Push to lower 2/3 of page
    paginator.advance(trim.heightMm * 0.60);
    const year = pe?.printDate ? pe.printDate.slice(0, 4) : String(new Date().getFullYear());
    const publisher = pe?.publisher || layout?.digitalEdition?.publisher;
    const isbn = pe?.isbn;
    const rights = rightsLabel(layout?.digitalEdition?.rights);
    paginator.drawParagraph([{ text: book.title || '', italic: true }], { align: 'center', size: 9, spaceAfterMm: 3 });
    paginator.drawParagraph([{ text: `© ${year} ${book.author || ''}` }], { align: 'center', size: 9, spaceAfterMm: 3 });
    if (publisher) paginator.drawParagraph([{ text: publisher }], { align: 'center', size: 9, spaceAfterMm: 3 });
    if (isbn) paginator.drawParagraph([{ text: `ISBN : ${isbn}` }], { align: 'center', size: 9, spaceAfterMm: 3 });
    if (pe?.printDate) paginator.drawParagraph([{ text: `Dépôt légal : ${pe.printDate}` }], { align: 'center', size: 9, spaceAfterMm: 3 });
    if (rights) paginator.drawParagraph([{ text: rights }], { align: 'center', size: 8, colorRgb: [0.4, 0.4, 0.4] });
    paginator.pageBreak(forceRecto);
  }

  // ─── 4. Table of contents (anchors filled in second pass — for now,
  //       we skip page numbers in TOC and just list titles. A two-pass
  //       approach for accurate TOC numbers requires layout to be fully
  //       deterministic; we add it after generation by overlaying numbers.) ───
  let tocPlaceholder: { pageIndex: number; entries: { id: string; label: string }[] } | null = null;
  if (book.tableOfContents) {
    paginator.newPage();
    const tocPageIndex = paginator.pages.length - 1;
    paginator.drawHeading('Table des matières', { size: 18, font: fonts.bold, align: 'center', spaceAfterMm: 8 });
    const entries: { id: string; label: string }[] = [];
    for (const ch of book.chapters) {
      const isSpecial = ch.type === 'front_matter' || ch.type === 'back_matter';
      if (isSpecial && ch.scenes.length === 0) continue;
      if (isSpecial) {
        for (let i = 0; i < ch.scenes.length; i++) {
          const s = ch.scenes[i];
          if (s.title) entries.push({ id: `special-${ch.type}-${i}`, label: s.title });
        }
      } else {
        const label = ch.title ? `Chapitre ${ch.number} — ${ch.title}` : `Chapitre ${ch.number}`;
        entries.push({ id: `chapter-${ch.number}`, label });
      }
    }
    if (book.glossary && book.glossary.length > 0) entries.push({ id: 'glossaire', label: 'Glossaire' });
    // Render entries with placeholder dots — page numbers patched after
    // chapters are laid out (see resolveTocPageNumbers below).
    for (const e of entries) {
      paginator.drawParagraph(
        [{ text: e.label }, { text: '   …   ', italic: true }, { text: '___' }],
        { align: 'left', spaceAfterMm: 1 },
      );
    }
    tocPlaceholder = { pageIndex: tocPageIndex, entries };
    paginator.pageBreak(forceRecto);
  }

  // ─── 5. Front matter (dédicace, remerciements en début) ───
  for (const ch of book.chapters) {
    if (ch.type !== 'front_matter') continue;
    if (ch.scenes.length === 0) continue;
    for (let i = 0; i < ch.scenes.length; i++) {
      const scene = ch.scenes[i];
      if (i > 0 || scene.title) {
        paginator.pageBreak(forceRecto);
        paginator.newPage();
      } else if (!paginator.current) {
        paginator.newPage();
      }
      if (scene.title) {
        paginator.recordAnchor(`special-front_matter-${i}`);
        paginator.drawHeading(scene.title, { size: 18, font: fonts.bold, align: 'center', spaceBeforeMm: 12, spaceAfterMm: 8 });
      }
      const blocks = parseHtmlBlocks(scene.content || '');
      renderBlocks(paginator, blocks);
    }
    paginator.pageBreak(forceRecto);
  }

  // ─── 6. Chapters ───
  let bodyStarted = false;
  for (const ch of book.chapters) {
    if (ch.type !== 'chapter') continue;
    paginator.pageBreak(forceRecto);
    if (!bodyStarted) {
      paginator.startBodyNumbering();
      bodyStarted = true;
    }
    paginator.newPage();
    paginator.recordAnchor(`chapter-${ch.number}`);
    paginator.advance(trim.heightMm * 0.10);
    const heading = ch.title ? `Chapitre ${ch.number} — ${ch.title}` : `Chapitre ${ch.number}`;
    paginator.drawHeading(heading, { size: 20, font: fonts.bold, align: 'center', spaceAfterMm: 12 });
    for (let i = 0; i < ch.scenes.length; i++) {
      if (i > 0) {
        const empty = !ch.scenes[i].content || !ch.scenes[i].content.trim();
        if (!empty) {
          paginator.drawSceneBreak();
        }
      }
      const scene = ch.scenes[i];
      if (scene.title) {
        paginator.drawParagraph(
          [{ text: scene.title, italic: true }],
          { align: 'center', spaceAfterMm: 4 },
        );
      }
      const blocks = parseHtmlBlocks(scene.content || '');
      renderBlocks(paginator, blocks);
    }
  }

  // ─── 7. Back matter (épilogue, remerciements, etc.) ───
  for (const ch of book.chapters) {
    if (ch.type !== 'back_matter') continue;
    if (ch.scenes.length === 0) continue;
    for (let i = 0; i < ch.scenes.length; i++) {
      const scene = ch.scenes[i];
      paginator.pageBreak(forceRecto);
      paginator.newPage();
      if (scene.title) {
        paginator.recordAnchor(`special-back_matter-${i}`);
        paginator.drawHeading(scene.title, { size: 18, font: fonts.bold, align: 'center', spaceBeforeMm: 12, spaceAfterMm: 8 });
      }
      const blocks = parseHtmlBlocks(scene.content || '');
      renderBlocks(paginator, blocks);
    }
  }

  // ─── 8. Glossary (auto-generated from glossary entries) ───
  if (book.glossary && book.glossary.length > 0) {
    paginator.pageBreak(forceRecto);
    paginator.newPage();
    paginator.recordAnchor('glossaire');
    paginator.drawHeading('Glossaire', { size: 20, font: fonts.bold, align: 'center', spaceAfterMm: 12 });
    for (const entry of book.glossary) {
      paginator.drawParagraph([{ text: entry.name, bold: true }], { align: 'left', spaceAfterMm: 1 });
      if (entry.description) {
        paginator.drawParagraph([{ text: entry.description }], { align: 'justify', spaceAfterMm: 4 });
      }
    }
  }

  // ─── 9. Back cover (screen mode only) ───
  if (opts.includeCovers) {
    const backSrc = book.resolvedCoverBack ?? book.layout?.coverBack;
    if (backSrc) {
      // Add a blank page to keep covers separate from main flow.
      await drawCoverPage(doc, backSrc, trim.widthMm, trim.heightMm);
    }
  }

  // ─── 10. Pad to multiple of 4 (print mode) ───
  if (opts.printMode) {
    paginator.padToMultipleOf4();
  }

  // ─── 11. Resolve TOC page numbers (best-effort) ───
  if (tocPlaceholder) {
    await resolveTocPageNumbers(paginator, fonts, tocPlaceholder);
  }

  return doc.save();
}

/** Render a list of blocks via the paginator. */
function renderBlocks(p: Paginator, blocks: Block[]): void {
  for (const b of blocks) {
    switch (b.kind) {
      case 'paragraph':
        p.drawParagraph(b.runs, { align: b.align ?? 'justify', indent: b.indent });
        break;
      case 'heading':
        p.drawHeading(b.text, { size: b.level === 1 ? 18 : b.level === 2 ? 14 : 12, spaceBeforeMm: 4, spaceAfterMm: 2, align: b.align ?? 'left' });
        break;
      case 'sceneTitle':
        p.drawParagraph([{ text: b.text, italic: true }], { align: 'center', spaceAfterMm: 4 });
        break;
      case 'sceneBreak':
        p.drawSceneBreak();
        break;
      case 'blockquote':
        p.drawParagraph(b.runs, { align: 'justify', leftIndentMm: 8, italicDefault: true, colorRgb: [0.3, 0.3, 0.3], spaceAfterMm: 2 });
        break;
      case 'list':
        for (let i = 0; i < b.items.length; i++) {
          const bullet = b.ordered ? `${i + 1}. ` : '• ';
          const runs = [{ text: bullet }, ...b.items[i]];
          p.drawParagraph(runs, { align: 'left', leftIndentMm: 6, spaceAfterMm: 1 });
        }
        break;
      case 'pageBreak':
        p.pageBreak(false);
        break;
      case 'rectoBreak':
        p.pageBreak(true);
        break;
    }
  }
}

/**
 * After all content is laid out, replace the TOC page's "___" placeholders
 * with the real page numbers from the recorded anchors. Implementation:
 * draw a small white rectangle over the placeholder zone, then re-render
 * the page numbers in their correct position.
 *
 * NOTE: This is a "best-effort overlay". It works because we know exactly
 * where placeholders were drawn. If the TOC layout changes, this needs
 * adjustment. For v1 we accept that the dotted leader is approximate.
 */
async function resolveTocPageNumbers(
  paginator: Paginator,
  fonts: Awaited<ReturnType<typeof loadFontSet>>,
  toc: { pageIndex: number; entries: { id: string; label: string }[] },
): Promise<void> {
  const page = paginator.pages[toc.pageIndex];
  if (!page) return;
  const cfg = paginator.cfg;
  const m = paginator.marginsMm(toc.pageIndex);
  const pageWidthPt = mmToPt(cfg.trimWidthMm);
  // The TOC entries were rendered starting after the heading; estimate Y
  // for each line. We assume each entry took 1 line at body lineHeight.
  const lineHeightPt = cfg.fontSize * cfg.lineHeight;
  const startTopMm = m.topMm + (18 * 1.3 / 72) * 25.4 + 8; // heading height + spaceAfter
  for (let i = 0; i < toc.entries.length; i++) {
    const e = toc.entries[i];
    const anchor = paginator.anchors.find((a) => a.id === e.id);
    if (!anchor) continue;
    const yMm = startTopMm + i * (((lineHeightPt) / 72) * 25.4 + 1) + lineHeightPt * 0.78 / 72 * 25.4;
    const yPt = mmToPt(cfg.trimHeightMm - yMm);
    const start = paginator.bodyStartIndex ?? 0;
    const num = anchor.pageIndex >= start
      ? String(anchor.pageIndex - start + 1)
      : '';
    if (!num) continue;
    const tw = fonts.regular.widthOfTextAtSize(num, cfg.fontSize);
    const xPt = mmToPt(cfg.trimWidthMm - m.rightMm) - tw;
    // White-out the "___" placeholder with a small rectangle
    page.drawRectangle({ x: xPt - 2, y: yPt - 2, width: tw + 4, height: cfg.fontSize + 2, color: rgb(1, 1, 1) });
    page.drawText(num, { x: xPt, y: yPt, size: cfg.fontSize, font: fonts.regular });
  }
}
