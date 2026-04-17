/**
 * Export DOCX (Word) à partir des données du livre.
 *
 * Utilise la bibliothèque `docx` pour générer un fichier .docx fidèle
 * aux exports EPUB/PDF existants :
 *  - Page de titre (titre, auteur, genre)
 *  - Table des matières (si activée)
 *  - Chapitres avec Heading 1, scènes avec Heading 2
 *  - Glossaire (optionnel)
 *  - Navigation dans le volet gauche de Word via les styles Heading
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  ImageRun,
  TabStopPosition,
  TabStopType,
  convertMillimetersToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import type { ExportBook } from '@/lib/export-shared';
import { getTrimSize } from '@/lib/print-edition';

// ── HTML to DOCX paragraphs converter ────────────────────────────

interface ParsedRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  superScript?: boolean;
  subScript?: boolean;
}

interface ParsedParagraph {
  runs: ParsedRun[];
  heading?: typeof HeadingLevel[keyof typeof HeadingLevel];
  alignment?: typeof AlignmentType[keyof typeof AlignmentType];
  bullet?: boolean;
  numbered?: boolean;
  indent?: number;
  isBlockquote?: boolean;
  isHr?: boolean;
  isImage?: { src: string };
}

/** Decode HTML entities */
function decodeEntities(text: string): string {
  return text
    .replace(/&#160;/g, '\u00A0')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#171;/g, '\u00AB')
    .replace(/&#187;/g, '\u00BB')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&nbsp;/g, '\u00A0')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Parse inline HTML into runs with formatting */
function parseInlineHtml(html: string): ParsedRun[] {
  const runs: ParsedRun[] = [];
  // Use a simple regex-based parser for inline formatting
  const tempDiv = html;

  // Strip tags and track formatting state
  let current = tempDiv;
  const result: ParsedRun[] = [];

  // Process the HTML by walking through tags
  const tagRegex = /<\/?([a-z][a-z0-9]*)[^>]*>|([^<]+)/gi;
  let match;

  const formatStack: { bold: boolean; italics: boolean; underline: boolean; strike: boolean; sup: boolean; sub: boolean }[] = [
    { bold: false, italics: false, underline: false, strike: false, sup: false, sub: false },
  ];

  const currentFormat = () => formatStack[formatStack.length - 1];

  while ((match = tagRegex.exec(current)) !== null) {
    if (match[2]) {
      // Text node
      const text = decodeEntities(match[2]);
      if (text) {
        const fmt = currentFormat();
        result.push({
          text,
          bold: fmt.bold || undefined,
          italics: fmt.italics || undefined,
          underline: fmt.underline || undefined,
          strike: fmt.strike || undefined,
          superScript: fmt.sup || undefined,
          subScript: fmt.sub || undefined,
        });
      }
    } else if (match[1]) {
      const tag = match[1].toLowerCase();
      const isClosing = match[0].startsWith('</');

      if (isClosing) {
        if (formatStack.length > 1) {
          formatStack.pop();
        }
      } else {
        const prev = { ...currentFormat() };
        if (tag === 'strong' || tag === 'b') prev.bold = true;
        if (tag === 'em' || tag === 'i') prev.italics = true;
        if (tag === 'u') prev.underline = true;
        if (tag === 's' || tag === 'del' || tag === 'strike') prev.strike = true;
        if (tag === 'sup') prev.sup = true;
        if (tag === 'sub') prev.sub = true;

        // Self-closing tags like <br/>, <hr/>, <img/>
        if (match[0].endsWith('/>') || tag === 'br') {
          if (tag === 'br') {
            result.push({ text: '\n' });
          }
          // Don't push to format stack for self-closing
        } else {
          formatStack.push(prev);
        }
      }
    }
  }

  return result.length > 0 ? result : [{ text: '' }];
}

/** Parse alignment from style attribute */
function parseAlignment(tag: string): typeof AlignmentType[keyof typeof AlignmentType] | undefined {
  const styleMatch = tag.match(/style="[^"]*text-align:\s*(center|right|justify|left)[^"]*"/);
  if (styleMatch) {
    switch (styleMatch[1]) {
      case 'center': return AlignmentType.CENTER;
      case 'right': return AlignmentType.RIGHT;
      case 'justify': return AlignmentType.JUSTIFIED;
      case 'left': return AlignmentType.LEFT;
    }
  }
  return undefined;
}

/** Parse TipTap HTML content into structured paragraphs for docx */
function parseHtmlToDocxParagraphs(html: string): ParsedParagraph[] {
  if (!html || html.trim() === '') return [{ runs: [{ text: '' }] }];

  const paragraphs: ParsedParagraph[] = [];

  // Match block-level elements
  const blockRegex = /<(p|h[1-6]|blockquote|ul|ol|li|hr|div|img)([^>]*)>([\s\S]*?)<\/\1>|<(hr|br|img)([^>]*?)\/?>|([^<]+)/gi;

  // More robust: split by block-level tags
  const blocks: string[] = [];
  let remaining = html.trim();

  // Split on block-level elements while preserving them
  const blockSplitRegex = /(<(?:p|h[1-6]|blockquote|ul|ol|div)[^>]*>[\s\S]*?<\/(?:p|h[1-6]|blockquote|ul|ol|div)>|<(?:hr|img)[^>]*\/?>)/gi;
  let lastIndex = 0;
  let blockMatch;

  while ((blockMatch = blockSplitRegex.exec(remaining)) !== null) {
    if (blockMatch.index > lastIndex) {
      const between = remaining.substring(lastIndex, blockMatch.index).trim();
      if (between) blocks.push(between);
    }
    blocks.push(blockMatch[0]);
    lastIndex = blockSplitRegex.lastIndex;
  }
  if (lastIndex < remaining.length) {
    const tail = remaining.substring(lastIndex).trim();
    if (tail) blocks.push(tail);
  }

  for (const block of blocks) {
    // HR
    if (/^<hr\s*\/?>$/i.test(block)) {
      paragraphs.push({ runs: [{ text: '* * *' }], alignment: AlignmentType.CENTER, isHr: true });
      continue;
    }

    // IMG
    const imgMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*\/?>/i);
    if (imgMatch) {
      paragraphs.push({ runs: [], isImage: { src: imgMatch[1] } });
      continue;
    }

    // Headings
    const headingMatch = block.match(/^<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>$/i);
    if (headingMatch) {
      const level = parseInt(headingMatch[1][1]);
      const headingLevel = level === 1 ? HeadingLevel.HEADING_3
        : level === 2 ? HeadingLevel.HEADING_4
        : HeadingLevel.HEADING_5;
      paragraphs.push({
        runs: parseInlineHtml(headingMatch[3]),
        heading: headingLevel,
        alignment: parseAlignment(headingMatch[2]),
      });
      continue;
    }

    // Blockquote
    const bqMatch = block.match(/^<blockquote([^>]*)>([\s\S]*?)<\/blockquote>$/i);
    if (bqMatch) {
      // Extract inner paragraphs from blockquote
      const innerParagraphs = parseHtmlToDocxParagraphs(bqMatch[2]);
      for (const p of innerParagraphs) {
        paragraphs.push({ ...p, isBlockquote: true, indent: 720 });
      }
      continue;
    }

    // Lists (ul/ol)
    const listMatch = block.match(/^<(ul|ol)([^>]*)>([\s\S]*?)<\/\1>$/i);
    if (listMatch) {
      const isOrdered = listMatch[1].toLowerCase() === 'ol';
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(listMatch[3])) !== null) {
        paragraphs.push({
          runs: parseInlineHtml(liMatch[1]),
          bullet: !isOrdered,
          numbered: isOrdered,
        });
      }
      continue;
    }

    // Regular paragraph
    const pMatch = block.match(/^<p([^>]*)>([\s\S]*?)<\/p>$/i);
    if (pMatch) {
      paragraphs.push({
        runs: parseInlineHtml(pMatch[2]),
        alignment: parseAlignment(pMatch[1]) || AlignmentType.JUSTIFIED,
      });
      continue;
    }

    // Div (treat like paragraph)
    const divMatch = block.match(/^<div([^>]*)>([\s\S]*?)<\/div>$/i);
    if (divMatch) {
      paragraphs.push({
        runs: parseInlineHtml(divMatch[2]),
        alignment: parseAlignment(divMatch[1]),
      });
      continue;
    }

    // Plain text
    if (block.trim()) {
      paragraphs.push({
        runs: parseInlineHtml(block),
        alignment: AlignmentType.JUSTIFIED,
      });
    }
  }

  return paragraphs;
}

/** Resolve image src to buffer for embedding in DOCX */
async function resolveImageBuffer(src: string): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  try {
    let blob: Blob;
    if (src.startsWith('data:')) {
      const match = src.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: match[1] });
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      blob = await resp.blob();
    } else {
      return null;
    }

    const buffer = await blob.arrayBuffer();

    // Get image dimensions
    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 400, height: 300 });
      img.src = URL.createObjectURL(blob);
    });

    return { buffer, ...dimensions };
  } catch {
    return null;
  }
}

// ── Font mapping for DOCX ────────────────────────────────────────

function getDocxFontName(fontFamily?: string): string {
  switch (fontFamily) {
    case 'Crimson Text': return 'Crimson Text';
    case 'Lora': return 'Lora';
    case 'Merriweather': return 'Merriweather';
    case 'EB Garamond': return 'EB Garamond';
    case 'Libre Baskerville': return 'Libre Baskerville';
    case 'Garamond': return 'Garamond';
    case 'Georgia': return 'Georgia';
    case 'Times New Roman':
    default:
      return 'Times New Roman';
  }
}

// ── Convert parsed paragraphs to docx Paragraph objects ──────────

function buildDocxParagraphs(
  parsed: ParsedParagraph[],
  fontSize: number,
  fontName: string,
  lineSpacing: number,
  images: Map<string, { buffer: ArrayBuffer; width: number; height: number }>,
  isFirstAfterHeading: boolean[] = [],
): Paragraph[] {
  const halfPoints = fontSize * 2; // docx uses half-points
  const lineSpacingValue = Math.round(lineSpacing * 240); // 240 twips per line

  return parsed.map((p, idx) => {
    // Image
    if (p.isImage && p.isImage.src) {
      const imgData = images.get(p.isImage.src);
      if (imgData) {
        // Scale to max 450pt width
        const maxWidth = 450;
        const scale = Math.min(1, maxWidth / imgData.width);
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new ImageRun({
              data: imgData.buffer,
              transformation: {
                width: Math.round(imgData.width * scale),
                height: Math.round(imgData.height * scale),
              },
              type: 'png',
            }),
          ],
        });
      }
    }

    // HR separator
    if (p.isHr) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
        children: [
          new TextRun({
            text: '* * *',
            font: fontName,
            size: halfPoints,
            color: '666666',
          }),
        ],
      });
    }

    // Determine indentation for first line (paragraph indent like in EPUB/PDF)
    const isFirstParagraph = idx === 0 || parsed[idx - 1]?.isHr || parsed[idx - 1]?.heading;
    const firstLineIndent = (!p.heading && !p.bullet && !p.numbered && !p.isBlockquote && !isFirstParagraph && p.alignment !== AlignmentType.CENTER)
      ? convertMillimetersToTwip(10) // ~1.5em indent
      : 0;

    const textRuns = p.runs.map((r) => {
      if (r.text === '\n') {
        return new TextRun({ break: 1 });
      }
      return new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italics || p.isBlockquote,
        underline: r.underline ? {} : undefined,
        strike: r.strike,
        superScript: r.superScript,
        subScript: r.subScript,
        font: fontName,
        size: p.heading ? undefined : halfPoints,
        color: p.isBlockquote ? '444444' : p.isHr ? '666666' : undefined,
      });
    });

    return new Paragraph({
      heading: p.heading,
      alignment: p.alignment,
      bullet: p.bullet ? { level: 0 } : undefined,
      numbering: p.numbered ? { reference: 'default-numbering', level: 0 } : undefined,
      indent: {
        left: p.isBlockquote ? 720 : undefined,
        firstLine: firstLineIndent || undefined,
      },
      spacing: {
        line: p.heading ? undefined : lineSpacingValue,
        before: p.heading ? 200 : 80,
        after: p.heading ? 100 : 80,
      },
      children: textRuns,
    });
  });
}

// ── Main export function ─────────────────────────────────────────

export async function exportDocx(book: ExportBook): Promise<void> {
  const fontName = getDocxFontName(book.layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily);
  const fontSize = book.layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = book.layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const halfPoints = fontSize * 2;

  // Collect all image sources from content to resolve them
  const imageSources = new Set<string>();
  for (const chapter of book.chapters) {
    for (const scene of chapter.scenes) {
      const imgRegex = /<img[^>]*src="([^"]+)"[^>]*\/?>/gi;
      let m;
      while ((m = imgRegex.exec(scene.content || '')) !== null) {
        imageSources.add(m[1]);
      }
    }
  }
  // Resolve cover images — prefer caller-resolved covers (advanced mode crop).
  const frontCoverSrc = book.resolvedCoverFront ?? book.layout?.coverFront;
  const backCoverSrc = book.resolvedCoverBack ?? book.layout?.coverBack;
  if (frontCoverSrc) imageSources.add(frontCoverSrc);
  if (backCoverSrc) imageSources.add(backCoverSrc);
  // Resolve map images
  if (book.maps) {
    for (const map of book.maps) {
      if (map.imageUrl) imageSources.add(map.imageUrl);
    }
  }

  // Resolve all images in parallel
  const imageMap = new Map<string, { buffer: ArrayBuffer; width: number; height: number }>();
  const imagePromises = Array.from(imageSources).map(async (src) => {
    const data = await resolveImageBuffer(src);
    if (data) imageMap.set(src, data);
  });
  await Promise.all(imagePromises);

  // ── Build document sections ──────────────────────────────────
  const sections: Paragraph[] = [];

  // ── Front cover ──────────────────────────────────────────────
  if (frontCoverSrc) {
    const coverData = imageMap.get(frontCoverSrc);
    if (coverData) {
      const maxWidth = 450;
      const maxHeight = 700;
      const scaleW = Math.min(1, maxWidth / coverData.width);
      const scaleH = Math.min(1, maxHeight / coverData.height);
      const scale = Math.min(scaleW, scaleH);
      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new ImageRun({
              data: coverData.buffer,
              transformation: {
                width: Math.round(coverData.width * scale),
                height: Math.round(coverData.height * scale),
              },
              type: 'png',
            }),
          ],
          pageBreakBefore: false,
        }),
      );
      sections.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  // ── Title page ───────────────────────────────────────────────
  sections.push(
    new Paragraph({ spacing: { before: 6000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: book.title,
          font: fontName,
          size: 56, // 28pt
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300 },
      children: [
        new TextRun({
          text: book.author,
          font: fontName,
          size: 32, // 16pt
          italics: true,
          color: '444444',
        }),
      ],
    }),
  );

  if (book.genre) {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 150 },
        children: [
          new TextRun({
            text: book.genre,
            font: fontName,
            size: 24, // 12pt
            color: '888888',
          }),
        ],
      }),
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Table of Contents (manual) ────────────────────────────────
  if (book.tableOfContents) {
    // Build TOC entries from chapters/scenes
    const tocEntries: { title: string; level: number }[] = [];
    for (const ch of book.chapters) {
      if ((ch.type === 'front_matter' || ch.type === 'back_matter') && ch.scenes.length === 0) continue;
      const isSpecial = ch.type === 'front_matter' || ch.type === 'back_matter';
      if (!isSpecial) {
        tocEntries.push({
          title: `Chapitre ${ch.number}${ch.title ? ` \u2014 ${ch.title}` : ''}`,
          level: 1,
        });
        // Add scene titles as sub-entries
        for (const scene of ch.scenes) {
          if (scene.title) {
            tocEntries.push({ title: scene.title, level: 2 });
          }
        }
      } else {
        // Front/back matter: individual scenes with title
        for (const scene of ch.scenes) {
          if (scene.title) {
            tocEntries.push({ title: scene.title, level: 1 });
          }
        }
      }
    }
    if (book.glossary && book.glossary.length > 0) {
      tocEntries.push({ title: 'Glossaire', level: 1 });
    }
    if (book.maps) {
      for (const map of book.maps) {
        if (map.imageUrl) tocEntries.push({ title: map.name, level: 1 });
      }
    }

    if (tocEntries.length > 0) {
      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: 'Table des matières',
              font: fontName,
              size: 32,
              bold: true,
            }),
          ],
        }),
      );

      for (const entry of tocEntries) {
        sections.push(
          new Paragraph({
            spacing: { before: entry.level === 1 ? 120 : 60, after: 60 },
            indent: entry.level === 2 ? { left: convertMillimetersToTwip(8) } : undefined,
            border: {
              bottom: {
                color: 'CCCCCC',
                space: 1,
                style: 'dotted' as any,
                size: 1,
              },
            },
            children: [
              new TextRun({
                text: entry.title,
                font: fontName,
                size: entry.level === 1 ? halfPoints : halfPoints - 2,
                bold: entry.level === 1,
                color: entry.level === 1 ? '1a1a1a' : '444444',
              }),
            ],
          }),
        );
      }

      sections.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  // ── Chapters and scenes ──────────────────────────────────────
  for (const chapter of book.chapters) {
    const isSpecial = chapter.type === 'front_matter' || chapter.type === 'back_matter';
    if (isSpecial && chapter.scenes.length === 0) continue;

    if (!isSpecial) {
      // Chapter heading (Heading 1 → navigation pane)
      const chapterTitle = `Chapitre ${chapter.number}${chapter.title ? ` \u2014 ${chapter.title}` : ''}`;
      sections.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 300 },
          pageBreakBefore: true,
          children: [
            new TextRun({
              text: chapterTitle,
              font: fontName,
            }),
          ],
        }),
      );

      for (let i = 0; i < chapter.scenes.length; i++) {
        const scene = chapter.scenes[i];

        // Scene separator
        if (i > 0) {
          sections.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 400 },
              children: [
                new TextRun({
                  text: '* * *',
                  font: fontName,
                  size: halfPoints,
                  color: '666666',
                }),
              ],
            }),
          );
        }

        // Scene title (Heading 2 → navigation pane)
        if (scene.title) {
          sections.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
              children: [
                new TextRun({
                  text: scene.title,
                  font: fontName,
                }),
              ],
            }),
          );
        }

        // Scene content
        const parsed = parseHtmlToDocxParagraphs(scene.content || '<p></p>');
        const docxParagraphs = buildDocxParagraphs(parsed, fontSize, fontName, lineHeight, imageMap);
        sections.push(...docxParagraphs);
      }
    } else {
      // Special chapters: each scene gets its own page
      for (let i = 0; i < chapter.scenes.length; i++) {
        const scene = chapter.scenes[i];

        if (scene.title) {
          sections.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { before: 600, after: 300 },
              pageBreakBefore: true,
              children: [
                new TextRun({
                  text: scene.title,
                  font: fontName,
                }),
              ],
            }),
          );
        } else if (i > 0) {
          sections.push(new Paragraph({ children: [new PageBreak()] }));
        }

        const parsed = parseHtmlToDocxParagraphs(scene.content || '<p></p>');
        const docxParagraphs = buildDocxParagraphs(parsed, fontSize, fontName, lineHeight, imageMap);
        sections.push(...docxParagraphs);
      }
    }
  }

  // ── Glossary ─────────────────────────────────────────────────
  if (book.glossary && book.glossary.length > 0) {
    sections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 300 },
        pageBreakBefore: true,
        children: [
          new TextRun({
            text: 'Glossaire',
            font: fontName,
          }),
        ],
      }),
    );

    for (const entry of book.glossary) {
      sections.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 250, after: 100 },
          children: [
            new TextRun({
              text: entry.name,
              font: fontName,
            }),
          ],
        }),
      );
      if (entry.description) {
        sections.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: entry.description,
                font: fontName,
                size: halfPoints,
              }),
            ],
          }),
        );
      }
    }
  }

  // ── Maps ─────────────────────────────────────────────────────
  if (book.maps && book.maps.length > 0) {
    for (const map of book.maps) {
      if (!map.imageUrl) continue;
      const mapImgData = imageMap.get(map.imageUrl);
      if (!mapImgData) continue;

      sections.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 300 },
          pageBreakBefore: true,
          children: [
            new TextRun({
              text: map.name,
              font: fontName,
            }),
          ],
        }),
      );

      const maxWidth = 500;
      const maxHeight = 650;
      const scaleW = Math.min(1, maxWidth / mapImgData.width);
      const scaleH = Math.min(1, maxHeight / mapImgData.height);
      const scale = Math.min(scaleW, scaleH);

      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new ImageRun({
              data: mapImgData.buffer,
              transformation: {
                width: Math.round(mapImgData.width * scale),
                height: Math.round(mapImgData.height * scale),
              },
              type: 'png',
            }),
          ],
        }),
      );
    }
  }

  // ── Back cover ───────────────────────────────────────────────
  if (backCoverSrc) {
    const backData = imageMap.get(backCoverSrc);
    if (backData) {
      const maxWidth = 450;
      const maxHeight = 700;
      const scaleW = Math.min(1, maxWidth / backData.width);
      const scaleH = Math.min(1, maxHeight / backData.height);
      const scale = Math.min(scaleW, scaleH);

      sections.push(new Paragraph({ children: [new PageBreak()] }));
      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new ImageRun({
              data: backData.buffer,
              transformation: {
                width: Math.round(backData.width * scale),
                height: Math.round(backData.height * scale),
              },
              type: 'png',
            }),
          ],
        }),
      );
    }
  }

  // ── Create the document ──────────────────────────────────────
  const lineSpacingValue = Math.round(lineHeight * 240);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: fontName,
            size: halfPoints,
          },
          paragraph: {
            spacing: {
              line: lineSpacingValue,
            },
          },
        },
        heading1: {
          run: {
            font: fontName,
            size: 36, // 18pt
            bold: true,
            color: '1a1a1a',
          },
          paragraph: {
            spacing: {
              before: 600,
              after: 300,
            },
          },
        },
        heading2: {
          run: {
            font: fontName,
            size: 26, // 13pt
            bold: true,
            color: '1a1a1a',
          },
          paragraph: {
            spacing: {
              before: 300,
              after: 200,
            },
          },
        },
        heading3: {
          run: {
            font: fontName,
            size: 22,
            bold: true,
            color: '333333',
          },
          paragraph: {
            spacing: {
              before: 200,
              after: 100,
            },
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: (() => {
            const pe = book.layout?.printEdition;
            const trim = pe ? getTrimSize(pe.trimSize) : { widthMm: 148, heightMm: 210 };
            const margins = pe?.margins ?? { topMm: 15, bottomMm: 20, innerMm: 18, outerMm: 15 };
            return {
              size: {
                width: convertMillimetersToTwip(trim.widthMm),
                height: convertMillimetersToTwip(trim.heightMm),
              },
              margin: {
                top: convertMillimetersToTwip(margins.topMm),
                bottom: convertMillimetersToTwip(margins.bottomMm),
                left: convertMillimetersToTwip(margins.innerMm),
                right: convertMillimetersToTwip(margins.outerMm),
              },
            };
          })(),
        },
        children: sections,
      },
    ],
  });

  // ── Generate and download ────────────────────────────────────
  let blob = await Packer.toBlob(doc);
  // The docx library does not expose a `mirrorMargins` setting, so we
  // post-process the .docx zip to inject `<w:mirrorMargins/>` into
  // word/settings.xml. This tells Word to swap left/right margins on
  // verso pages so "inner" and "outer" margins alternate correctly.
  blob = await injectMirrorMargins(blob);
  const safeName = book.title
    .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæ\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  saveAs(blob, `${safeName}.docx`);
}

async function injectMirrorMargins(blob: Blob): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);
  const settingsFile = zip.file('word/settings.xml');
  if (!settingsFile) return blob;
  let xml = await settingsFile.async('string');
  if (xml.includes('<w:mirrorMargins')) return blob;
  // Insert <w:mirrorMargins/> as the first child of <w:settings>. The opening
  // tag carries the namespaces so we insert just after it.
  xml = xml.replace(/(<w:settings[^>]*>)/, '$1<w:mirrorMargins/>');
  zip.file('word/settings.xml', xml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
