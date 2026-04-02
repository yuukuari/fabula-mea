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
 *  - OEBPS/title.xhtml
 *  - OEBPS/chapter-N.xhtml   (un fichier par chapitre)
 */
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { BookLayout } from '@/types';
import { FONT_STACKS, DEFAULT_LAYOUT } from '@/lib/fonts';

interface ExportChapter {
  id: string;
  number: number;
  title: string;
  type?: 'front_matter' | 'chapter' | 'back_matter';
  scenes: { title: string; content: string }[];
}

interface ExportMap {
  id: string;
  name: string;
  imageUrl: string; // base64 data URL or CDN URL
}

interface ExportBook {
  title: string;
  author: string;
  genre: string;
  synopsis: string;
  chapters: ExportChapter[];
  glossary?: { name: string; type: string; description: string }[];
  maps?: ExportMap[];
  layout?: BookLayout;
  tableOfContents?: boolean;
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
    .replace(/style="text-align:\s*(center|right|justify|left)"/g, 'style="text-align: $1"')
    // Convertir &nbsp; en espace insécable XHTML valide
    .replace(/&nbsp;/g, '&#160;')
    // Nettoyer d'autres entités HTML qui ne sont pas valides en XHTML
    .replace(/&mdash;/g, '&#8212;')
    .replace(/&ndash;/g, '&#8211;')
    .replace(/&laquo;/g, '&#171;')
    .replace(/&raquo;/g, '&#187;')
    .replace(/&hellip;/g, '&#8230;')
    .replace(/&amp;nbsp;/g, '&#160;');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Extrait le type MIME et les données base64 d'un data URL */
function parseDataUrl(dataUrl: string): { mimeType: string; ext: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg';
  return { mimeType, ext, base64 };
}

/** Fetches a remote image URL and returns its data as base64 + metadata */
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; ext: string; base64: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { mimeType, ext, base64 };
  } catch {
    return null;
  }
}

/** Resolves an image source (base64 data URL or HTTP URL) to base64 data for EPUB packaging */
async function resolveImageData(src: string): Promise<{ mimeType: string; ext: string; base64: string } | null> {
  if (src.startsWith('data:')) {
    return parseDataUrl(src);
  }
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return fetchImageAsBase64(src);
  }
  return null;
}

// ── CSS du livre ─────────────────────────────────────────────────

function buildBookCss(layout?: BookLayout): string {
  const fontStack = FONT_STACKS[layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily];
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;

  return `
body {
  font-family: ${fontStack};
  line-height: ${lineHeight};
  font-size: ${fontSize}pt;
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
.special-scene-title {
  font-size: 1.8em;
  font-weight: bold;
  text-align: center;
  margin: 2em 0 1em;
  page-break-before: always;
}
.map-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}
`;
}

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
  zip.file('OEBPS/style.css', buildBookCss(book.layout));

  // 4. Couverture (si disponible)
  let coverImageId = '';
  let coverImageFilename = '';
  let coverImageMimeType = '';
  if (book.layout?.coverFront) {
    const parsed = await resolveImageData(book.layout.coverFront);
    if (parsed) {
      coverImageFilename = `cover.${parsed.ext}`;
      coverImageMimeType = parsed.mimeType;
      coverImageId = 'cover-image';
      zip.file(`OEBPS/${coverImageFilename}`, parsed.base64, { base64: true });
    }
  }

  // 5. Page de titre
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

  // 6. Chapitres
  const chapterFiles: { id: string; filename: string; title: string }[] = [];

  for (const chapter of book.chapters) {
    // Skip front/back matter with no scenes
    if ((chapter.type === 'front_matter' || chapter.type === 'back_matter') && chapter.scenes.length === 0) continue;

    const isSpecial = chapter.type === 'front_matter' || chapter.type === 'back_matter';

    if (!isSpecial) {
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
<head><title>${escapeXml(chapter.title || `Chapitre ${chapter.number}`)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`
      );

      chapterFiles.push({
        id: chId,
        filename,
        title: `Chapitre ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}`,
      });
    } else {
      // Special chapters: each scene gets its own file (page break effect)
      for (let i = 0; i < chapter.scenes.length; i++) {
        const scene = chapter.scenes[i];
        const fileId = `${chapter.type}-${i}`;
        const filename = `${chapter.type}-${i}.xhtml`;

        let body = '';
        if (scene.title) {
          body += `<h1 class="special-scene-title">${escapeXml(scene.title)}</h1>\n`;
        }
        body += cleanHtml(scene.content || '<p></p>') + '\n';

        zip.file(
          `OEBPS/${filename}`,
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr" lang="fr">
<head><title>${escapeXml(scene.title || 'Sans titre')}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`
        );

        chapterFiles.push({
          id: fileId,
          filename,
          title: scene.title || '',
        });
      }
    }
  }

  // 6b. Glossaire (optionnel) — sans label de type
  if (book.glossary && book.glossary.length > 0) {
    let glossaryBody = '<h1>Glossaire</h1>\n';
    for (const entry of book.glossary) {
      glossaryBody += `<h2>${escapeXml(entry.name)}</h2>\n`;
      if (entry.description) {
        glossaryBody += `<p>${escapeXml(entry.description)}</p>\n`;
      }
    }
    zip.file(
      'OEBPS/glossary.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr" lang="fr">
<head><title>Glossaire</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${glossaryBody}
</body>
</html>`
    );
    chapterFiles.push({ id: 'glossary', filename: 'glossary.xhtml', title: 'Glossaire' });
  }

  // 6c. Cartes (optionnel)
  const mapFiles: { id: string; filename: string; title: string; imageFilename: string; imageMimeType: string }[] = [];
  if (book.maps && book.maps.length > 0) {
    for (const map of book.maps) {
      if (!map.imageUrl) continue;
      const parsed = await resolveImageData(map.imageUrl);
      if (!parsed) continue;

      const imageFilename = `map-${map.id}.${parsed.ext}`;
      const mapFilename = `map-${map.id}.xhtml`;
      const mapId = `map-${map.id}`;

      zip.file(`OEBPS/${imageFilename}`, parsed.base64, { base64: true });
      zip.file(
        `OEBPS/${mapFilename}`,
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr" lang="fr">
<head><title>${escapeXml(map.name)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>${escapeXml(map.name)}</h1>
<img src="${imageFilename}" alt="${escapeXml(map.name)}" class="map-image"/>
</body>
</html>`
      );

      chapterFiles.push({ id: mapId, filename: mapFilename, title: map.name });
      mapFiles.push({ id: mapId, filename: mapFilename, title: map.name, imageFilename, imageMimeType: parsed.mimeType });
    }
  }

  // 7. Table of Contents (XHTML - EPUB 3)
  // Build TOC entries — special chapters show individual scenes
  const tocEntries: { filename: string; title: string }[] = [];
  for (const ch of book.chapters) {
    if ((ch.type === 'front_matter' || ch.type === 'back_matter') && ch.scenes.length === 0) continue;
    const isSpecial = ch.type === 'front_matter' || ch.type === 'back_matter';
    if (!isSpecial) {
      const filename = `chapter-${ch.number}.xhtml`;
      tocEntries.push({ filename, title: `Chapitre ${ch.number}${ch.title ? ` — ${ch.title}` : ''}` });
    } else {
      ch.scenes.forEach((scene, i) => {
        if (scene.title) {
          tocEntries.push({ filename: `${ch.type}-${i}.xhtml`, title: scene.title });
        }
      });
    }
  }
  if (book.glossary && book.glossary.length > 0) {
    tocEntries.push({ filename: 'glossary.xhtml', title: 'Glossaire' });
  }
  for (const m of mapFiles) {
    tocEntries.push({ filename: m.filename, title: m.title });
  }

  // TOC navigation file (always included for EPUB readers)
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
${tocEntries.map((ch) => `      <li><a href="${ch.filename}">${escapeXml(ch.title)}</a></li>`).join('\n')}
    </ol>
  </nav>
</body>
</html>`
  );

  // 8. toc.ncx (EPUB 2 compat)
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
${tocEntries
  .map(
    (ch, i) => `    <navPoint id="nav-${i}" playOrder="${i + 2}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${ch.filename}"/>
    </navPoint>`
  )
  .join('\n')}
  </navMap>
</ncx>`
  );

  // 9. content.opf (Package Document)
  const allContentFiles = chapterFiles;
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator id="creator">${escapeXml(book.author || 'Auteur')}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
    <dc:language>fr</dc:language>
    <dc:date>${now}</dc:date>
    ${book.synopsis ? `<dc:description>${escapeXml(book.synopsis)}</dc:description>` : ''}
    ${book.genre ? `<dc:subject>${escapeXml(book.genre)}</dc:subject>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z/, 'Z')}</meta>
    ${coverImageId ? `<meta name="cover" content="${coverImageId}"/>` : ''}
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="title-page" href="title.xhtml" media-type="application/xhtml+xml"/>
    ${coverImageId ? `<item id="${coverImageId}" href="${coverImageFilename}" media-type="${coverImageMimeType}" properties="cover-image"/>` : ''}
${allContentFiles.map((ch) => `    <item id="${ch.id}" href="${ch.filename}" media-type="application/xhtml+xml"/>`).join('\n')}
${mapFiles.map((m) => `    <item id="${m.id}-img" href="${m.imageFilename}" media-type="${m.imageMimeType}"/>`).join('\n')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title-page"/>
    <itemref idref="toc"/>
${allContentFiles.map((ch) => `    <itemref idref="${ch.id}"/>`).join('\n')}
  </spine>
</package>`
  );

  // 10. Générer le ZIP et télécharger
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const safeName = book.title.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæ\s-]/g, '').trim().replace(/\s+/g, '-');
  saveAs(blob, `${safeName}.epub`);
}
