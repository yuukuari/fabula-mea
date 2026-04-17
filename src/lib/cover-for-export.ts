/**
 * Compose the front or back cover image for EPUB/PDF/DOCX exports.
 *
 * - Simplified mode: returns `layout.coverFront` / `coverBack` directly.
 * - Advanced mode: crops the flat cover image to the requested side's trim
 *   area and draws the text overlays on top via Canvas API. Returns a base64
 *   data URL that any export pipeline can embed.
 *
 * CORS notes for prod:
 *   - Vercel Blob public URLs serve `Access-Control-Allow-Origin: *`, so
 *     `img.crossOrigin = 'anonymous'` loads them without tainting the canvas.
 *   - In dev, covers are base64 data URLs — no CORS concern.
 *   - On any failure (cross-origin without CORS, decode error, etc.) we fall
 *     back to the full flat image URL so the export still has *some* cover.
 */
import type { BookLayout, Chapter, Scene, CoverTextOverlay, CountUnit } from '@/types';
import { getCoverMode, getAdvancedCover } from './cover-composition';
import {
  calculateCoverDimensions, estimatePageCount,
  type CoverDimensions,
} from './print-edition';
import { DEFAULT_LAYOUT, FONT_STACKS } from './fonts';
import { totalScenesCount, isSpecialChapter } from './utils';

export async function resolveCoverForExport(
  layout: BookLayout | undefined,
  side: 'front' | 'back',
  scenes: Scene[],
  chapters: Chapter[],
  countUnit: CountUnit,
): Promise<string | undefined> {
  if (!layout) return undefined;
  const mode = getCoverMode(layout);

  if (mode === 'simplified') {
    return side === 'front' ? layout.coverFront : layout.coverBack;
  }

  // Advanced mode
  const advanced = getAdvancedCover(layout);
  if (!advanced.flatImage || !layout.printEdition) {
    return side === 'front' ? layout.coverFront : layout.coverBack;
  }

  const pe = layout.printEdition;
  const total = totalScenesCount(scenes, countUnit);
  const chapterCount = chapters.filter((c) => !isSpecialChapter(c)).length;
  const pageCount = estimatePageCount(
    total, pe.trimSize,
    layout.fontSize ?? DEFAULT_LAYOUT.fontSize,
    layout.lineHeight ?? DEFAULT_LAYOUT.lineHeight,
    pe.margins, chapterCount,
  );
  const dims = calculateCoverDimensions(pe.trimSize, pageCount, pe.paperType, pe.bleedMm);

  try {
    return await composeCoverSide(advanced.flatImage, advanced.overlays ?? [], dims, side);
  } catch {
    // Fall back to the uncropped flat image so the export has something.
    return advanced.flatImage;
  }
}

async function composeCoverSide(
  flatUrl: string,
  overlays: CoverTextOverlay[],
  dims: CoverDimensions,
  side: 'front' | 'back',
): Promise<string> {
  const img = await loadImage(flatUrl);

  // Source-image pixels per mm of the physical cover.
  const pxPerMm = img.naturalWidth / dims.totalWidthMm;

  const startMm = side === 'front'
    ? dims.bleedMm + dims.backWidthMm + dims.spineWidthMm
    : dims.bleedMm;
  const trimWidthMm = side === 'front' ? dims.frontWidthMm : dims.backWidthMm;
  const trimHeightMm = dims.totalHeightMm - 2 * dims.bleedMm;

  const sx = Math.round(startMm * pxPerMm);
  const sy = Math.round(dims.bleedMm * pxPerMm);
  const sw = Math.round(trimWidthMm * pxPerMm);
  const sh = Math.round(trimHeightMm * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // Overlay text — only those whose bounding box intersects the current side.
  const regionEndMm = startMm + trimWidthMm;
  for (const o of overlays) {
    const oxMm = (o.xPct / 100) * dims.totalWidthMm;
    const owMm = (o.widthPct / 100) * dims.totalWidthMm;
    if (oxMm + owMm < startMm || oxMm > regionEndMm) continue;

    const oyMm = (o.yPct / 100) * dims.totalHeightMm;
    const ohMm = (o.heightPct / 100) * dims.totalHeightMm;

    const cxPx = (oxMm - startMm + owMm / 2) * pxPerMm;
    const cyPx = (oyMm - dims.bleedMm + ohMm / 2) * pxPerMm;
    // fontSize is stored in "CSS px at 96 DPI reference" (1 px ≈ 0.2646 mm).
    // Convert to mm, then to source-image pixels.
    const fontPx = o.fontSize * 0.2646 * pxPerMm;

    ctx.save();
    ctx.translate(cxPx, cyPx);
    ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.fillStyle = o.color;
    const style = o.fontStyle === 'italic' ? 'italic ' : '';
    const weight = o.fontWeight === 'bold' ? 'bold ' : '';
    const fontStack = (FONT_STACKS as Record<string, string>)[o.fontFamily]
      ?? `'${o.fontFamily}', sans-serif`;
    ctx.font = `${style}${weight}${fontPx}px ${fontStack}`;
    ctx.textAlign = o.textAlign === 'left' ? 'left' : o.textAlign === 'right' ? 'right' : 'center';
    ctx.textBaseline = 'middle';

    const lines = (o.content || '').split('\n');
    const lineHeight = fontPx * 1.1;
    const yStart = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, 0, yStart + i * lineHeight));
    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load cover image'));
    img.src = url;
  });
}
