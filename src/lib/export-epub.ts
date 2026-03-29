/**
 * Génération d'un fichier EPUB à partir des données du livre.
 *
 * Structure EPUB 3 :
 *  - mimetype
 *  - META-INF/container.xml
 *  - OEBPS/content.opf      (métadonnées + manifest + spine)
 *  - OEBPS/toc.ncx           (table of contents NCX - EPUB 2 compat)
 *  - OEBPS/toc.xhtml         (table of contents EPUB 3)
 *  - OEBPS/style.css
 *  - OEBPS/chapter-N.xhtml   (un fichier par chapitre)
 */
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ExportChapter {
  id: string;
  number: number;
  title: string;
  scenes: { title: string; content: string }[];
}

interface ExportBook {
  title: string;
  author: string;
  genre: string;
  synopsis: string;
  chapters: ExportChapter[];
}

// ── Helpers ──────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Nettoie le HTML TipTap pour le rendre XHTML-compatible */
function cleanHtml(html: string): string {
  if (!html) return '<p></p>';
  return html
    // Fermer les balises auto-fermantes
    .replace(/<br>/g, '<br/>')
    .replace(/<hr>/g, '<hr/>')
    .replace(/<img([^>]*?)>/g, '<img$1/>')
    // Supprimer les attributs class (spécifiques à l'éditeur)
    .replace(/\s+class="[^"]*"/g, '')
    // Supprimer les data-attributes
    .replace(/\s+data-[a-z-]+="[^"]*"/g, '')
    // Nettoyer les spans vides laissés par TipTap
    .replace(/<span>\s*<\/span>/g, '')
    // Convertir text-align en attribut style
    .replace(/style="text-align:\s*(center|right|justify|left)"/g, 'style="text-align: $1"');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── CSS du livre ─────────────────────────────────────────────────

const BOOK_CSS = `
body {
  font-family: "Georgia", "Times New Roman", serif;
  line-height: 1.6;
  margin: 1em;
  color: #1a1a1a;
}
h1 {
  font-size: 1.8em;
  font-weight: bold;
  text-align: center;
  margin: 2em 0 1em;
  page-break-before: always;
}
h2 {
  font-size: 1.3em;
  font-weight: bold;
  margin: 1.5em 0 0.5em;
}
h3 {
  font-size: 1.1em;
  font-weight: bold;
  margin: 1em 0 0.4em;
}
p {
  margin: 0.5em 0;
  text-align: justify;
  text-indent: 1.5em;
}
p:first-child, h1 + p, h2 + p, h3 + p, hr + p {
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
  margin: 2em 0;
}
hr::after {
  content: "* * *";
  color: #666;
  font-size: 0.9em;
  letter-spacing: 0.5em;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}
ul, ol {
  margin: 0.5em 0;
  padding-left: 2em;
}
a {
  color: #333;
  text-decoration: underline;
}
.title-page {
  text-align: center;
  margin-top: 30%;
}
.title-page h1 {
  font-size: 2.5em;
  page-break-before: auto;
}
.title-page .author {
  font-size: 1.3em;
  margin-top: 1em;
  font-style: italic;
}
.title-page .genre {
  margin-top: 0.5em;
  color: #666;
}
.scene-title {
  font-weight: bold;
  font-size: 1.05em;
  margin: 1.5em 0 0.5em;
  text-indent: 0;
}
`;

// ── Génération EPUB ──────────────────────────────────────────────

export async function exportEpub(book: ExportBook): Promise<void> {
  const zip = new JSZip();
  const uuid = generateUUID();
  const now = new Date().toISOString().split('T')[0];

  // 1. mimetype (DOIT être le premier fichier, non compressé)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. Style
  zip.file('OEBPS/style.css', BOOK_CSS);

  // 4. Page de titre
  zip.file(
    'OEBPS/title.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr" lang="fr">
<head><title>${escapeXml(book.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <div class="title-page">
    <h1>${escapeXml(book.title)}</h1>
    <p class="author">${escapeXml(book.author)}</p>
    ${book.genre ? `<p class="genre">${escapeXml(book.genre)}</p>` : ''}
  </div>
</body>
</html>`
  );

  // 5. Chapitres
  const chapterFiles: { id: string; filename: string; title: string }[] = [];

  for (const chapter of book.chapters) {
    const filename = `chapter-${chapter.number}.xhtml`;
    const chId = `ch-${chapter.number}`;

    let body = `<h1>Chapitre ${chapter.number}${chapter.title ? ` — ${escapeXml(chapter.title)}` : ''}</h1>\n`;

    for (let i = 0; i < chapter.scenes.length; i++) {
      const scene = chapter.scenes[i];
      if (i > 0) {
        body += `<hr />\n`;
      }
      if (scene.title && chapter.scenes.length > 1) {
        body += `<p class="scene-title">${escapeXml(scene.title)}</p>\n`;
      }
      body += cleanHtml(scene.content || '<p></p>') + '\n';
    }

    zip.file(
      `OEBPS/${filename}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr" lang="fr">
<head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`
    );

    chapterFiles.push({ id: chId, filename, title: `Chapitre ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}` });
  }

  // 6. Table of Contents (XHTML - EPUB 3)
  zip.file(
    'OEBPS/toc.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><title>Table des matières</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <nav epub:type="toc">
    <h1>Table des matières</h1>
    <ol>
${chapterFiles.map((ch) => `      <li><a href="${ch.filename}">${escapeXml(ch.title)}</a></li>`).join('\n')}
    </ol>
  </nav>
</body>
</html>`
  );

  // 7. toc.ncx (EPUB 2 compat)
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
  </head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>
    <navPoint id="title" playOrder="1">
      <navLabel><text>Page de titre</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
${chapterFiles
  .map(
    (ch, i) => `    <navPoint id="${ch.id}" playOrder="${i + 2}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${ch.filename}"/>
    </navPoint>`
  )
  .join('\n')}
  </navMap>
</ncx>`
  );

  // 8. content.opf (Package Document)
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author)}</dc:creator>
    <dc:language>fr</dc:language>
    <dc:date>${now}</dc:date>
    ${book.synopsis ? `<dc:description>${escapeXml(book.synopsis)}</dc:description>` : ''}
    ${book.genre ? `<dc:subject>${escapeXml(book.genre)}</dc:subject>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="title-page" href="title.xhtml" media-type="application/xhtml+xml"/>
${chapterFiles.map((ch) => `    <item id="${ch.id}" href="${ch.filename}" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title-page"/>
    <itemref idref="toc"/>
${chapterFiles.map((ch) => `    <itemref idref="${ch.id}"/>`).join('\n')}
  </spine>
</package>`
  );

  // 9. Générer le ZIP et télécharger
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const safeName = book.title.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæ\s-]/g, '').trim().replace(/\s+/g, '-');
  saveAs(blob, `${safeName}.epub`);
}
