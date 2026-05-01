/**
 * Public PDF export API. Generates the PDF directly using pdf-lib (no
 * dependency on the browser's print dialog), which guarantees exact margins
 * and trim size.
 *
 * Two modes:
 *  - `exportPdf(book)` — single PDF for screen/lecture: covers full-page,
 *    same margins both sides, suitable for liseuse / lecture verticale.
 *  - `exportPdfPrint(book)` — ZIP with two PDFs (interior + cover) for the
 *    printer: interior has alternating margins, blank pages forcing recto
 *    chapter starts, multiple-of-4 page count, no covers; cover is a
 *    separate file with bleed and spine.
 */
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { ExportBook } from '@/lib/export-shared';
import { countFromHtml } from '@/lib/utils';
import { buildInteriorPdf } from './pdf/document';
import { buildCoverPdfBytes } from './pdf/cover';

function safeFileName(s: string): string {
  return (s || 'livre').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

/** Single-PDF export for screen / e-reader reading. */
export async function exportPdf(book: ExportBook): Promise<void> {
  const bytes = await buildInteriorPdf(book, { printMode: false, includeCovers: true });
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  saveAs(blob, `${safeFileName(book.title)}.pdf`);
}

/**
 * Print-ready ZIP export: interior PDF (no covers, alternating margins,
 * pad to multiple of 4) + standalone cover PDF (with bleed + spine).
 */
export async function exportPdfPrint(book: ExportBook): Promise<void> {
  const interior = await buildInteriorPdf(book, { printMode: true, includeCovers: false });

  const zip = new JSZip();
  zip.file('interieur.pdf', interior);

  // Build cover PDF (only if printEdition is configured).
  if (book.layout?.printEdition) {
    const wordCount = book.chapters.reduce(
      (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + countFromHtml(sc.content ?? '', 'words'), 0),
      0,
    );
    const chapterCount = book.chapters.filter((c) => c.type === 'chapter').length;
    const coverBytes = await buildCoverPdfBytes({
      layout: book.layout,
      title: book.title,
      author: book.author,
      wordCount,
      chapterCount,
      fontSize: book.layout.fontSize ?? 12,
      lineHeight: book.layout.lineHeight ?? 1.5,
    });
    if (coverBytes) zip.file('couverture.pdf', coverBytes);
  }

  // Add a small README for the printer.
  zip.file(
    'LISEZMOI.txt',
    [
      `Bundle d'impression — ${book.title || 'Livre'}`,
      `Auteur : ${book.author || ''}`,
      '',
      `Fichiers inclus :`,
      `  • interieur.pdf — pages intérieures, format trim exact, marges alternées`,
      `                    recto/verso, pages padées à un multiple de 4.`,
      `  • couverture.pdf — couverture dépliée (4ème + dos + 1ère) avec fond perdu.`,
      '',
      `Envoyer ces deux fichiers à votre imprimeur (KDP, IngramSpark, BoD, Lulu...).`,
    ].join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${safeFileName(book.title)}-impression.zip`);
}

