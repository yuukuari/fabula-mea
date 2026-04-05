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

function buildPdfStyles(layout?: BookLayout): string {
  const fontStack = FONT_STACKS[layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily];
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;

  return `
  @page {
    size: A5;
    margin: 1.2cm 1.5cm 1.8cm;
    @bottom-center {
      content: counter(page);
      font-family: ${fontStack};
      font-size: 9pt;
      color: #666;
    }
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

export function exportPdf(book: ExportBook): void {
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

  // Cover pages
  const frontCoverHtml = book.layout?.coverFront
    ? `<div class="cover-page"><img src="${book.layout.coverFront}" alt="Couverture" /></div>`
    : '';
  const backCoverHtml = book.layout?.coverBack
    ? `<div class="back-cover-page"><img src="${book.layout.coverBack}" alt="4ème de couverture" /></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(book.title)} — PDF</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&display=swap" rel="stylesheet" />
  <style>${buildPdfStyles(book.layout)}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>

  ${frontCoverHtml}

  <div class="title-page">
    <h1>${escapeXml(book.title)}</h1>
    <p class="author">${escapeXml(book.author)}</p>
    ${book.genre ? `<p class="genre">${escapeXml(book.genre)}</p>` : ''}
  </div>

  ${tocHtml}

  ${chaptersHtml}
  ${glossaryHtml}

  ${backCoverHtml}
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
