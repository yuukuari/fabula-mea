/**
 * Font resolution for the PDF generator.
 *
 * - System fonts (Times New Roman, Georgia, Garamond): not on Google Fonts.
 *   Fallback to pdf-lib's built-in Times-Roman family (WinAnsi, FR OK).
 * - Google Fonts (Crimson, Lora, Merriweather, EB Garamond, Libre Baskerville):
 *   fetched as TTF from the jsDelivr mirror at export time, embedded via
 *   `@pdf-lib/fontkit`. These support full Unicode (no need for sanitization).
 *
 * A single in-memory cache lives for the page session; closing the tab clears
 * it. We don't pre-fetch — fonts are loaded only when a PDF is generated.
 */
import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { BookFont } from '@/types';

export interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  /** Sans-serif used for page numbers, captions. */
  sans: PDFFont;
  /** True when the family is a pdf-lib built-in (forces sanitizeForWinAnsi). */
  builtin: boolean;
}

export interface VariantUrls {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
}

/** TTF URLs on the jsDelivr mirror of the Google Fonts repo. */
export const FONT_URLS: Partial<Record<BookFont, VariantUrls>> = {
  'Crimson Text': {
    regular:    'https://cdn.jsdelivr.net/gh/google/fonts/ofl/crimsontext/CrimsonText-Regular.ttf',
    bold:       'https://cdn.jsdelivr.net/gh/google/fonts/ofl/crimsontext/CrimsonText-SemiBold.ttf',
    italic:     'https://cdn.jsdelivr.net/gh/google/fonts/ofl/crimsontext/CrimsonText-Italic.ttf',
    boldItalic: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/crimsontext/CrimsonText-SemiBoldItalic.ttf',
  },
  'Lora': {
    regular:    'https://cdn.jsdelivr.net/gh/google/fonts/ofl/lora/static/Lora-Regular.ttf',
    bold:       'https://cdn.jsdelivr.net/gh/google/fonts/ofl/lora/static/Lora-Bold.ttf',
    italic:     'https://cdn.jsdelivr.net/gh/google/fonts/ofl/lora/static/Lora-Italic.ttf',
    boldItalic: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/lora/static/Lora-BoldItalic.ttf',
  },
  'Merriweather': {
    regular:    'https://cdn.jsdelivr.net/gh/google/fonts/ofl/merriweather/Merriweather-Regular.ttf',
    bold:       'https://cdn.jsdelivr.net/gh/google/fonts/ofl/merriweather/Merriweather-Bold.ttf',
    italic:     'https://cdn.jsdelivr.net/gh/google/fonts/ofl/merriweather/Merriweather-Italic.ttf',
    boldItalic: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/merriweather/Merriweather-BoldItalic.ttf',
  },
  'EB Garamond': {
    regular:    'https://cdn.jsdelivr.net/gh/google/fonts/ofl/ebgaramond/static/EBGaramond-Regular.ttf',
    bold:       'https://cdn.jsdelivr.net/gh/google/fonts/ofl/ebgaramond/static/EBGaramond-Bold.ttf',
    italic:     'https://cdn.jsdelivr.net/gh/google/fonts/ofl/ebgaramond/static/EBGaramond-Italic.ttf',
    boldItalic: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/ebgaramond/static/EBGaramond-BoldItalic.ttf',
  },
  'Libre Baskerville': {
    regular:    'https://cdn.jsdelivr.net/gh/google/fonts/ofl/librebaskerville/LibreBaskerville-Regular.ttf',
    bold:       'https://cdn.jsdelivr.net/gh/google/fonts/ofl/librebaskerville/LibreBaskerville-Bold.ttf',
    italic:     'https://cdn.jsdelivr.net/gh/google/fonts/ofl/librebaskerville/LibreBaskerville-Italic.ttf',
    // Libre Baskerville has no bold-italic variant — fall back to bold.
    boldItalic: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/librebaskerville/LibreBaskerville-Bold.ttf',
  },
};

const fontBytesCache = new Map<string, ArrayBuffer>();

async function fetchTtf(url: string): Promise<ArrayBuffer | null> {
  if (fontBytesCache.has(url)) return fontBytesCache.get(url)!;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const bytes = await r.arrayBuffer();
    fontBytesCache.set(url, bytes);
    return bytes;
  } catch (err) {
    console.warn('[pdf/fonts] fetch failed', url, err);
    return null;
  }
}

/** Built-in Times family — always available, no network. */
async function loadBuiltinSet(doc: PDFDocument): Promise<FontSet> {
  const [regular, bold, italic, boldItalic, sans] = await Promise.all([
    doc.embedFont(StandardFonts.TimesRoman),
    doc.embedFont(StandardFonts.TimesRomanBold),
    doc.embedFont(StandardFonts.TimesRomanItalic),
    doc.embedFont(StandardFonts.TimesRomanBoldItalic),
    doc.embedFont(StandardFonts.Helvetica),
  ]);
  return { regular, bold, italic, boldItalic, sans, builtin: true };
}

/**
 * Load fonts for the document. If `family` is a Google Font we have URLs for,
 * embed those. Otherwise fall back to Times-Roman built-in.
 */
export async function loadFontSet(doc: PDFDocument, family?: BookFont): Promise<FontSet> {
  const urls = family ? FONT_URLS[family] : undefined;
  if (!urls) return loadBuiltinSet(doc);

  doc.registerFontkit(fontkit);
  const [reg, bold, ital, bi] = await Promise.all([
    fetchTtf(urls.regular),
    fetchTtf(urls.bold),
    fetchTtf(urls.italic),
    fetchTtf(urls.boldItalic),
  ]);
  if (!reg || !bold || !ital || !bi) {
    console.warn('[pdf/fonts] could not fetch all variants of', family, '— falling back to Times');
    return loadBuiltinSet(doc);
  }
  // `subset: true` keeps the PDF small by including only used glyphs.
  const [regular, b, i, biEmbed, sans] = await Promise.all([
    doc.embedFont(reg, { subset: true }),
    doc.embedFont(bold, { subset: true }),
    doc.embedFont(ital, { subset: true }),
    doc.embedFont(bi, { subset: true }),
    doc.embedFont(StandardFonts.Helvetica),
  ]);
  return { regular, bold: b, italic: i, boldItalic: biEmbed, sans, builtin: false };
}

/** Pick the right variant for a run's flags. */
export function pickFont(fonts: FontSet, bold?: boolean, italic?: boolean): PDFFont {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

/**
 * Sanitize text for WinAnsi-encoded standard fonts: replace characters
 * outside Latin-1 with closest ASCII equivalents (or '?'). Only needed
 * when using built-in fonts; embedded TTFs handle Unicode natively.
 */
export function sanitizeForWinAnsi(s: string): string {
  return s
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[   ​‌‍]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

/** Pass-through or sanitize depending on font type. */
export function safeText(s: string, fonts: FontSet): string {
  return fonts.builtin ? sanitizeForWinAnsi(s) : s;
}
