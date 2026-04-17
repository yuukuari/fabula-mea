/**
 * Export PDF via window.print() sur un document HTML stylisé.
 * Ouvre une fenêtre avec le contenu du livre formaté pour l'impression,
 * puis déclenche le dialogue d'impression du navigateur (qui permet
 * d'enregistrer en PDF).
 */
import type { BookLayout } from '@/types';
import { FONT_STACKS, DEFAULT_LAYOUT } from '@/lib/fonts';
import { escapeXml, cleanHtml } from '@/lib/export-shared';
import type { ExportBook } from '@/lib/export-shared';
import { getTrimSize } from '@/lib/print-edition';

function buildPdfStyles(layout?: BookLayout): string {
  const fontStack = FONT_STACKS[layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily];
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const pe = layout?.printEdition;
  const trim = pe ? getTrimSize(pe.trimSize) : { widthMm: 148, heightMm: 210 };
  const margins = pe?.margins ?? { topMm: 12, bottomMm: 18, innerMm: 15, outerMm: 15 };

  // Alternating margins: spine (inner) on the LEFT of recto (right-hand) pages
  // and on the RIGHT of verso (left-hand) pages. Chromium's print engine honors
  // the :left / :right page pseudo-selectors; the generic @page rule below is
  // a fallback for single-page contexts.
  return `
  @page {
    size: ${trim.widthMm}mm ${trim.heightMm}mm;
    margin: ${margins.topMm}mm ${margins.outerMm}mm ${margins.bottomMm}mm ${margins.innerMm}mm;
    @bottom-center {
      content: counter(page);
      font-family: ${fontStack};
      font-size: 9pt;
      color: #666;
    }
  }
  @page :right {
    margin: ${margins.topMm}mm ${margins.outerMm}mm ${margins.bottomMm}mm ${margins.innerMm}mm;
  }
  @page :left {
    margin: ${margins.topMm}mm ${margins.innerMm}mm ${margins.bottomMm}mm ${margins.outerMm}mm;
  }
  @media print {
    .no-print { display: none !important; }
    .chapter-break { page-break-before: always; }
    .special-scene-break { page-break-before: always; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: ${fontStack};
    font-size: ${fontSize}pt;
    line-height: ${lineHeight};
    color: #1a1a1a;
    margin: 0;
    padding: 1.2cm 1.5cm;
  }
  .cover-page {
    page-break-after: always;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
  }
  .cover-page img {
    max-width: 100%;
    max-height: 100%;
    display: block;
  }
  .back-cover-page {
    page-break-before: always;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
  }
  .back-cover-page img {
    max-width: 100%;
    max-height: 100%;
    display: block;
  }
  .title-page {
    text-align: center;
    padding-top: 30vh;
    page-break-after: always;
  }
  .title-page h1 {
    font-size: 28pt;
    margin: 0;
  }
  .title-page .author {
    font-size: 16pt;
    margin-top: 0.8em;
    font-style: italic;
    color: #444;
  }
  .title-page .genre {
    font-size: 12pt;
    margin-top: 0.4em;
    color: #888;
  }
  .blank-page {
    page-break-after: always;
    height: 100vh;
  }
  .copyright-page {
    page-break-after: always;
    font-size: 9pt;
    color: #444;
    padding-top: 65vh;
    text-align: center;
    line-height: 1.6;
  }
  .copyright-page p { margin: 0.3em 0; }
  .copyright-page .title { font-style: italic; margin-bottom: 0.6em; }
  .copyright-page .copyright-symbol { font-size: 10pt; }
  .copyright-page .rights { margin-top: 1em; font-size: 8pt; color: #666; }
  .toc {
    page-break-after: always;
  }
  .toc h2 {
    text-align: center;
    font-size: 16pt;
    margin-bottom: 1em;
  }
  .toc ul {
    list-style: none;
    padding: 0;
  }
  .toc li {
    padding: 0.3em 0;
    border-bottom: 1px dotted #ccc;
    font-size: 11pt;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .toc li a {
    color: inherit;
    text-decoration: none;
    flex: 1;
  }
  .toc li a::after {
    content: target-counter(attr(href url), page);
    float: right;
    color: #666;
  }
  .toc li .ch-num {
    font-weight: bold;
    margin-right: 0.5em;
  }
  .chapter-break {
    font-size: 18pt;
    text-align: center;
    margin: 0 0 1em;
    padding-top: 2em;
    font-weight: bold;
  }
  .special-scene-break {
    font-size: 18pt;
    text-align: center;
    margin: 0 0 1em;
    padding-top: 2em;
    font-weight: bold;
  }
  h2 { font-size: 14pt; margin: 1.5em 0 0.5em; }
  h3 { font-size: 12pt; margin: 1em 0 0.4em; }
  p {
    margin: 0.4em 0;
    text-align: justify;
    text-indent: 1.5em;
  }
  p:first-child, .chapter-break + p, .special-scene-break + p, h2 + p, h3 + p, hr + p {
    text-indent: 0;
  }
  blockquote {
    margin: 1em 2em;
    font-style: italic;
    border-left: 2px solid #999;
    padding-left: 1em;
    color: #444;
  }
  hr {
    border: none;
    text-align: center;
    margin: 1.5em 0;
  }
  hr::after {
    content: "* * *";
    color: #666;
    font-size: 10pt;
    letter-spacing: 0.5em;
  }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
  }
  ul, ol {
    margin: 0.4em 0;
    padding-left: 2em;
  }
  .print-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #7a1b3a;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    font-family: sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 9999;
  }
  .print-btn:hover { background: #5a1329; }
`;
}

export interface PdfExportOptions {
  /** When true, add technical pages (blank after cover, auto-generated copyright page). */
  printReady?: boolean;
}

/** Human-readable text for a license/rights code. */
function rightsLabel(rights?: string): string | null {
  const map: Record<string, string> = {
    all_rights_reserved: 'Tous droits réservés.',
    cc_by: 'Licence Creative Commons Attribution 4.0 (CC BY 4.0).',
    cc_by_sa: 'Licence Creative Commons Attribution - Partage dans les mêmes conditions 4.0 (CC BY-SA 4.0).',
    cc_by_nc: 'Licence Creative Commons Attribution - Pas d\'utilisation commerciale 4.0 (CC BY-NC 4.0).',
    cc_by_nc_sa: 'Licence Creative Commons Attribution - Pas d\'utilisation commerciale - Partage dans les mêmes conditions 4.0 (CC BY-NC-SA 4.0).',
    cc_by_nd: 'Licence Creative Commons Attribution - Pas de modification 4.0 (CC BY-ND 4.0).',
    cc_by_nc_nd: 'Licence Creative Commons Attribution - Pas d\'utilisation commerciale - Pas de modification 4.0 (CC BY-NC-ND 4.0).',
    public_domain: 'Œuvre placée dans le domaine public.',
  };
  return rights && map[rights] ? map[rights] : null;
}

/** Generate copyright page HTML (auto). */
function buildCopyrightPage(book: ExportBook): string {
  const pe = book.layout?.printEdition;
  const de = book.layout?.digitalEdition;
  const year = (pe?.printDate ? pe.printDate.slice(0, 4) : String(new Date().getFullYear()));
  const publisher = pe?.publisher || de?.publisher;
  const isbn = pe?.isbn;
  const rights = rightsLabel(de?.rights);

  const lines: string[] = [];
  lines.push(`<p class="title">${escapeXml(book.title)}</p>`);
  lines.push(`<p class="copyright-symbol">© ${escapeXml(year)} ${escapeXml(book.author || 'Auteur')}</p>`);
  if (publisher) lines.push(`<p>${escapeXml(publisher)}</p>`);
  if (isbn) lines.push(`<p>ISBN : ${escapeXml(isbn)}</p>`);
  if (pe?.printDate) lines.push(`<p>Dépôt légal : ${escapeXml(pe.printDate)}</p>`);
  if (rights) lines.push(`<p class="rights">${escapeXml(rights)}</p>`);

  return `<div class="copyright-page">${lines.join('\n')}</div>`;
}

export function exportPdf(book: ExportBook, opts: PdfExportOptions = {}): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez que les popups ne sont pas bloqués.');
    return;
  }

  let chaptersHtml = '';

  for (const chapter of book.chapters) {
    const isSpecial = chapter.type === 'front_matter' || chapter.type === 'back_matter';
    if (isSpecial && chapter.scenes.length === 0) continue;

    if (!isSpecial) {
      const chapterId = `chapter-${chapter.number}`;
      chaptersHtml += `<h2 id="${chapterId}" class="chapter-break">Chapitre ${chapter.number}${chapter.title ? ` — ${escapeXml(chapter.title)}` : ''}</h2>\n`;
      for (let i = 0; i < chapter.scenes.length; i++) {
        const scene = chapter.scenes[i];
        if (i > 0) {
          chaptersHtml += `<hr />\n`;
        }
        if (scene.title) {
          chaptersHtml += `<p class="scene-title">${escapeXml(scene.title)}</p>\n`;
        }
        chaptersHtml += cleanHtml(scene.content || '<p></p>') + '\n';
      }
    } else {
      // Special chapters: each scene gets its own page break
      for (let i = 0; i < chapter.scenes.length; i++) {
        const scene = chapter.scenes[i];
        const sceneId = `special-${chapter.type}-${i}`;
        if (scene.title) {
          chaptersHtml += `<h2 id="${sceneId}" class="special-scene-break">${escapeXml(scene.title)}</h2>\n`;
        } else {
          chaptersHtml += `<div id="${sceneId}" class="special-scene-break" style="display:none;"></div>`;
          if (i > 0) {
            // Force page break even without title
            chaptersHtml += `<div style="page-break-before:always;"></div>`;
          }
        }
        chaptersHtml += cleanHtml(scene.content || '<p></p>') + '\n';
      }
    }
  }

  // Glossaire (optionnel) — without type label
  let glossaryHtml = '';
  if (book.glossary && book.glossary.length > 0) {
    glossaryHtml += '<h2 id="glossaire" class="chapter-break">Glossaire</h2>\n';
    for (const entry of book.glossary) {
      glossaryHtml += `<h3>${escapeXml(entry.name)}</h3>\n`;
      if (entry.description) {
        glossaryHtml += `<p>${escapeXml(entry.description)}</p>\n`;
      }
    }
  }

  // Table des matières
  let tocHtml = '';
  if (book.tableOfContents) {
    const tocItems: string[] = [];
    for (const ch of book.chapters) {
      if ((ch.type === 'front_matter' || ch.type === 'back_matter') && ch.scenes.length === 0) continue;
      if (ch.type === 'front_matter' || ch.type === 'back_matter') {
        // Show individual scenes (only if they have a title)
        ch.scenes.forEach((scene, i) => {
          if (scene.title) {
            const sceneId = `special-${ch.type}-${i}`;
            tocItems.push(`<li><a href="#${sceneId}">${escapeXml(scene.title)}</a></li>`);
          }
        });
      } else {
        const chapterId = `chapter-${ch.number}`;
        tocItems.push(`<li><a href="#${chapterId}"><span class="ch-num">Chapitre ${ch.number}</span> ${escapeXml(ch.title || '')}</a></li>`);
      }
    }
    if (book.glossary && book.glossary.length > 0) {
      tocItems.push(`<li><a href="#glossaire">Glossaire</a></li>`);
    }
    if (tocItems.length > 0) {
      tocHtml = `<div class="toc">
  <h2>Table des matières</h2>
  <ul>${tocItems.join('\n')}</ul>
</div>`;
    }
  }

  // Cover pages — prefer caller-resolved covers (advanced mode cropped to
  // front/back), fall back to raw simplified covers.
  const frontCoverSrc = book.resolvedCoverFront ?? book.layout?.coverFront;
  const backCoverSrc = book.resolvedCoverBack ?? book.layout?.coverBack;
  const frontCoverHtml = frontCoverSrc
    ? `<div class="cover-page"><img src="${frontCoverSrc}" alt="Couverture" /></div>`
    : '';
  const backCoverHtml = backCoverSrc
    ? `<div class="back-cover-page"><img src="${backCoverSrc}" alt="4ème de couverture" /></div>`
    : '';

  // Print-ready technical pages
  const blankAfterCoverHtml = opts.printReady && frontCoverSrc
    ? `<div class="blank-page"></div>`
    : '';
  const copyrightHtml = opts.printReady
    ? buildCopyrightPage(book)
    : '';
  const blankBeforeBackCoverHtml = opts.printReady && backCoverSrc
    ? `<div class="blank-page"></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(book.title)} — PDF${opts.printReady ? ' (prêt à imprimer)' : ''}</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&display=swap" rel="stylesheet" />
  <style>${buildPdfStyles(book.layout)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>

  ${frontCoverHtml}
  ${blankAfterCoverHtml}

  <div class="title-page">
    <h1>${escapeXml(book.title)}</h1>
    <p class="author">${escapeXml(book.author)}</p>
    ${book.genre ? `<p class="genre">${escapeXml(book.genre)}</p>` : ''}
  </div>

  ${copyrightHtml}

  ${tocHtml}

  ${chaptersHtml}
  ${glossaryHtml}

  ${blankBeforeBackCoverHtml}
  ${backCoverHtml}
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
