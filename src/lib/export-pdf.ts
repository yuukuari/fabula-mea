/**
 * Export PDF via window.print() sur un document HTML stylisé.
 * Ouvre une fenêtre avec le contenu du livre formaté pour l'impression,
 * puis déclenche le dialogue d'impression du navigateur (qui permet
 * d'enregistrer en PDF).
 */

interface ExportChapter {
  number: number;
  title: string;
  type?: 'front_matter' | 'chapter' | 'back_matter';
  scenes: { title: string; content: string }[];
}

interface ExportBook {
  title: string;
  author: string;
  genre: string;
  synopsis: string;
  chapters: ExportChapter[];
}

function cleanHtml(html: string): string {
  if (!html) return '<p></p>';
  return html
    .replace(/\s+class="[^"]*"/g, '')
    .replace(/\s+data-[a-z-]+="[^"]*"/g, '')
    .replace(/<span>\s*<\/span>/g, '');
}

const PDF_STYLES = `
  @page {
    size: A5;
    margin: 1.2cm 1cm;
  }
  @media print {
    .no-print { display: none !important; }
    h1 { page-break-before: always; }
    h1:first-of-type { page-break-before: auto; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    margin: 0;
    padding: 1.2cm;
  }
  .title-page {
    text-align: center;
    padding-top: 30vh;
    page-break-after: always;
  }
  .title-page h1 {
    font-size: 28pt;
    margin: 0;
    page-break-before: auto;
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
  }
  .toc li .ch-num {
    font-weight: bold;
    margin-right: 0.5em;
  }
  h1 {
    font-size: 18pt;
    text-align: center;
    margin: 0 0 1em;
    padding-top: 2em;
  }
  h2 { font-size: 14pt; margin: 1.5em 0 0.5em; }
  h3 { font-size: 12pt; margin: 1em 0 0.4em; }
  p {
    margin: 0.4em 0;
    text-align: justify;
    text-indent: 1.5em;
  }
  p:first-child, h1 + p, h2 + p, h3 + p, hr + p, .scene-title + p {
    text-indent: 0;
  }
  .scene-title {
    font-weight: bold;
    font-size: 11pt;
    margin: 1.5em 0 0.5em;
    text-indent: 0;
    text-align: left;
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

export function exportPdf(book: ExportBook): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez que les popups ne sont pas bloqués.');
    return;
  }

  let chaptersHtml = '';

  for (const chapter of book.chapters) {
    const isSpecial = chapter.type === 'front_matter' || chapter.type === 'back_matter';
    // Skip front/back matter with no scenes
    if (isSpecial && chapter.scenes.length === 0) continue;

    if (!isSpecial) {
      chaptersHtml += `<h1>Chapitre ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}</h1>\n`;
    }
    for (let i = 0; i < chapter.scenes.length; i++) {
      const scene = chapter.scenes[i];
      if (i > 0) {
        chaptersHtml += `<hr />\n`;
      }
      if (scene.title && (isSpecial || chapter.scenes.length > 1)) {
        chaptersHtml += `<p class="scene-title">${scene.title}</p>\n`;
      }
      chaptersHtml += cleanHtml(scene.content || '<p></p>') + '\n';
    }
  }

  const tocHtml = book.chapters
    .filter((ch) => !((ch.type === 'front_matter' || ch.type === 'back_matter') && ch.scenes.length === 0))
    .map((ch) => {
      if (ch.type === 'front_matter' || ch.type === 'back_matter') {
        const label = ch.scenes.length === 1 && ch.scenes[0].title ? ch.scenes[0].title : (ch.type === 'front_matter' ? 'Avant l\'histoire' : 'Après l\'histoire');
        return `<li>${label}</li>`;
      }
      return `<li><span class="ch-num">Chapitre ${ch.number}</span> ${ch.title || ''}</li>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${book.title} — PDF</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>

  <div class="title-page">
    <h1>${book.title}</h1>
    <p class="author">${book.author}</p>
    ${book.genre ? `<p class="genre">${book.genre}</p>` : ''}
  </div>

  <div class="toc">
    <h2>Table des matières</h2>
    <ul>${tocHtml}</ul>
  </div>

  ${chaptersHtml}
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
