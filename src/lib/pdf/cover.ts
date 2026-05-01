/**
 * Cover image embedding for the screen PDF, plus a stand-alone print-ready
 * cover PDF (back+spine+front with bleed) for the print bundle.
 */
import { PDFDocument, PDFImage, StandardFonts, degrees, rgb } from 'pdf-lib';
import { mmToPt } from './layout';
import { sanitizeForWinAnsi } from './fonts';
import type { BookLayout } from '@/types';
import { calculateCoverDimensions, calculateSpineWidth, getTrimSize, estimatePageCount } from '@/lib/print-edition';
import { getCoverMode, getAdvancedCover, resolveSpineRender, resolveCoverColor, SPINE_MIN_TEXT_MM } from '@/lib/cover-composition';

/** Embed an image (data URL or remote URL) into the document. */
export async function embedImageData(doc: PDFDocument, src: string): Promise<PDFImage | null> {
  try {
    const bytes = await fetchImageBytes(src);
    if (!bytes) return null;
    const u8 = new Uint8Array(bytes);
    const isPng = u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47;
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (err) {
    console.warn('[pdf/cover] embedImageData failed', err);
    return null;
  }
}

async function fetchImageBytes(src: string): Promise<ArrayBuffer | null> {
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    const meta = src.slice(0, comma);
    const data = src.slice(comma + 1);
    const isBase64 = /;base64/i.test(meta);
    if (isBase64) {
      const bin = atob(data);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr.buffer;
    }
    return new TextEncoder().encode(decodeURIComponent(data)).buffer;
  }
  const r = await fetch(src);
  if (!r.ok) return null;
  return r.arrayBuffer();
}

/**
 * Load src into an HTMLImageElement (preserves CORS-able origins).
 */
function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Cover-fit + crop the source image into the given target aspect ratio,
 * returning a JPEG data URL. We do this BEFORE embedding so the embedded
 * image already matches the destination region exactly — avoiding the
 * overflow-onto-the-spine issue we'd hit with naive aspect-fit drawing.
 */
async function cropImageToRect(src: string, targetWidthMm: number, targetHeightMm: number): Promise<string | null> {
  try {
    const img = await loadHtmlImage(src);
    // Target output pixels: aim for ~300 DPI at the target mm size.
    const dpi = 300;
    const pxPerMm = dpi / 25.4;
    const outW = Math.round(targetWidthMm * pxPerMm);
    const outH = Math.round(targetHeightMm * pxPerMm);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Cover behaviour: fill the canvas, crop overflow.
    const scale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const dx = (outW - drawW) / 2;
    const dy = (outH - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (err) {
    console.warn('[pdf/cover] cropImageToRect failed', err);
    return null;
  }
}

/**
 * Draw a cover image full-bleed on a page sized to trim. Used only in
 * screen mode (lecture). The image is centered + cropped (cover behaviour).
 */
export async function drawCoverPage(doc: PDFDocument, src: string, trimWidthMm: number, trimHeightMm: number): Promise<void> {
  const page = doc.addPage([mmToPt(trimWidthMm), mmToPt(trimHeightMm)]);
  // Pre-crop so the embed has the exact aspect ratio of the page.
  const cropped = await cropImageToRect(src, trimWidthMm, trimHeightMm);
  const img = cropped ? await embedImageData(doc, cropped) : await embedImageData(doc, src);
  if (!img) return;
  page.drawImage(img, { x: 0, y: 0, width: mmToPt(trimWidthMm), height: mmToPt(trimHeightMm) });
}

/**
 * Generate a stand-alone cover PDF (back + spine + front, with bleed) for
 * the print bundle. Returns the bytes.
 */
export async function buildCoverPdfBytes(input: {
  layout: BookLayout | undefined;
  title: string;
  author: string;
  wordCount: number;
  chapterCount: number;
  fontSize: number;
  lineHeight: number;
}): Promise<Uint8Array | null> {
  const { layout, title, author } = input;
  const pe = layout?.printEdition;
  if (!pe) return null;
  const trim = getTrimSize(pe.trimSize);
  const pageCount = estimatePageCount(input.wordCount, pe.trimSize, input.fontSize, input.lineHeight, pe.margins, input.chapterCount);
  const spine = calculateSpineWidth(pageCount, pe.paperType);
  const realDims = calculateCoverDimensions(pe.trimSize, pageCount, pe.paperType, pe.bleedMm);
  const totalW = realDims.totalWidthMm;
  const totalH = realDims.totalHeightMm;
  const bleed = realDims.bleedMm;
  const innerH = totalH - 2 * bleed;
  const backX = bleed;
  const spineX = backX + realDims.backWidthMm;
  const frontX = spineX + spine;

  const doc = await PDFDocument.create();
  const page = doc.addPage([mmToPt(totalW), mmToPt(totalH)]);
  const mode = getCoverMode(layout);
  const coverColor = resolveCoverColor(layout);

  /** Draw an image cropped to exactly fit the region (no overflow). */
  async function drawIntoRegion(src: string, xMm: number, yMm: number, wMm: number, hMm: number) {
    // Canvas-crop first so embedded image matches the region 1:1.
    const cropped = await cropImageToRect(src, wMm, hMm);
    const img = cropped ? await embedImageData(doc, cropped) : await embedImageData(doc, src);
    if (!img) return;
    const w = mmToPt(wMm);
    const h = mmToPt(hMm);
    const x = mmToPt(xMm);
    const y = mmToPt(totalH - yMm - hMm);
    page.drawImage(img, { x, y, width: w, height: h });
  }

  /** Rectangle, top-down mm coordinates. */
  function drawRect(xMm: number, yMm: number, wMm: number, hMm: number, color: { r: number; g: number; b: number }) {
    page.drawRectangle({
      x: mmToPt(xMm),
      y: mmToPt(totalH - yMm - hMm),
      width: mmToPt(wMm),
      height: mmToPt(hMm),
      color: rgb(color.r, color.g, color.b),
    });
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const num = parseInt(v.padEnd(6, '0').slice(0, 6), 16);
    return { r: ((num >> 16) & 0xff) / 255, g: ((num >> 8) & 0xff) / 255, b: (num & 0xff) / 255 };
  }

  if (mode === 'advanced') {
    const flat = getAdvancedCover(layout).flatImage;
    if (flat) {
      await drawIntoRegion(flat, 0, 0, totalW, totalH);
    } else {
      // No flat image: fill with cover color so overlays have a visible base.
      drawRect(0, 0, totalW, totalH, hexToRgb(coverColor));
    }

    // Render text overlays from the editor on top of the flat.
    const overlays = getAdvancedCover(layout).overlays ?? [];
    if (overlays.length > 0) {
      const fonts = {
        regular: await doc.embedFont(StandardFonts.TimesRoman),
        bold: await doc.embedFont(StandardFonts.TimesRomanBold),
        italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
        boldItalic: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
      };
      for (const o of overlays) {
        const oxMm = (o.xPct / 100) * totalW;
        const oyMm = (o.yPct / 100) * totalH;
        const owMm = (o.widthPct / 100) * totalW;
        const ohMm = (o.heightPct / 100) * totalH;
        const cxMm = oxMm + owMm / 2;
        const cyMm = oyMm + ohMm / 2;
        // overlay.fontSize is "CSS px @ 96 DPI" (1 px ≈ 0.2646 mm).
        const fontSizeMm = o.fontSize * 0.2646;
        const fontSizePt = mmToPt(fontSizeMm);
        const isBold = o.fontWeight === 'bold' || Number(o.fontWeight) >= 600;
        const isItalic = o.fontStyle === 'italic';
        const font = isBold && isItalic ? fonts.boldItalic
          : isBold ? fonts.bold
          : isItalic ? fonts.italic
          : fonts.regular;
        const text = sanitizeForWinAnsi(o.content || '');
        if (!text) continue;
        const tw = font.widthOfTextAtSize(text, fontSizePt);
        // Anchor in pdf-lib coords (bottom-up) for the un-rotated text:
        // align horizontally inside overlay box, vertically center.
        let anchorXMm = oxMm;
        if (o.textAlign === 'center') anchorXMm = cxMm - (tw / 72) * 25.4 / 2;
        else if (o.textAlign === 'right') anchorXMm = oxMm + owMm - (tw / 72) * 25.4;
        const anchorYMm = cyMm + fontSizeMm * 0.3; // approximate baseline offset
        const xPt = mmToPt(anchorXMm);
        const yPt = mmToPt(totalH - anchorYMm);
        const c = hexToRgb(o.color || '#000000');
        // Rotation: pdf-lib rotates around the (x, y) anchor. We want rotation
        // around the overlay center. Translate the anchor onto the rotated
        // axis by computing the rotated position of the original anchor
        // relative to the center.
        if (o.rotation) {
          const cxPt = mmToPt(cxMm);
          const cyPt = mmToPt(totalH - cyMm);
          const rad = (-o.rotation) * Math.PI / 180; // pdf-lib y-up: invert sign vs SVG
          const dx = xPt - cxPt;
          const dy = yPt - cyPt;
          const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
          const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
          page.drawText(text, {
            x: cxPt + rx, y: cyPt + ry,
            size: fontSizePt, font,
            color: rgb(c.r, c.g, c.b),
            rotate: degrees(-o.rotation),
          });
        } else {
          page.drawText(text, {
            x: xPt, y: yPt,
            size: fontSizePt, font,
            color: rgb(c.r, c.g, c.b),
          });
        }
      }
    }
  } else {
    // Simplified: back image | spine | front image
    if (layout?.coverBack) {
      await drawIntoRegion(layout.coverBack, backX, bleed, realDims.backWidthMm, innerH);
    } else {
      drawRect(backX, bleed, realDims.backWidthMm, innerH, hexToRgb(coverColor));
    }

    // Spine — drawn AFTER potential back overflow (which canvas-crop now
    // prevents anyway), and BEFORE front to keep ordering predictable.
    const spineRender = resolveSpineRender(layout, title, author, spine);
    drawRect(spineX, bleed, spine, innerH, hexToRgb(spineRender.color));

    if (spineRender.showText && spine >= SPINE_MIN_TEXT_MM) {
      const font = await doc.embedFont(StandardFonts.TimesRomanBold);
      const label = author ? `${title} — ${author}` : title;
      const safe = sanitizeForWinAnsi(label);
      const fontSizeMm = Math.max(spine * 0.45, 2);
      const fontSizePt = mmToPt(fontSizeMm);
      const tw = font.widthOfTextAtSize(safe, fontSizePt);
      const cxPt = mmToPt(spineX + spine / 2);
      const cyPt = mmToPt(totalH / 2);
      const rotateDeg = spineRender.orientation === 'ttb' ? -90 : 90;
      const sr = hexToRgb(spineRender.textColor);
      // pdf-lib rotates around the anchor (baseline-left in local coords).
      // We want the visual middle of the text (baseline midpoint shifted up
      // by ~0.3·fontSize for the typical serif visual centre) to land on
      // (cxPt, cyPt) after rotation:
      //   anchor = center - R(θ)·(tw/2, 0.3·fs)
      // For θ = ±90°, cos=0 so x only depends on the sin·0.3·fs term and
      // y only depends on the cos·tw/2 term.
      const baselineOffsetPt = fontSizePt * 0.3;
      const sign = rotateDeg > 0 ? 1 : -1;
      page.drawText(safe, {
        x: cxPt + sign * baselineOffsetPt,
        y: cyPt - sign * tw / 2,
        size: fontSizePt,
        font,
        color: rgb(sr.r, sr.g, sr.b),
        rotate: degrees(rotateDeg),
      });
    }

    // Front
    if (layout?.coverFront) {
      await drawIntoRegion(layout.coverFront, frontX, bleed, trim.widthMm, innerH);
    } else {
      drawRect(frontX, bleed, trim.widthMm, innerH, hexToRgb(coverColor));
      const titleFont = await doc.embedFont(StandardFonts.TimesRomanBold);
      const authorFont = await doc.embedFont(StandardFonts.TimesRoman);
      const t = sanitizeForWinAnsi(title || 'Titre');
      const a = sanitizeForWinAnsi(author || 'Auteur');
      const titleSizePt = mmToPt(trim.widthMm * 0.06);
      const authorSizePt = mmToPt(trim.widthMm * 0.03);
      const tw = titleFont.widthOfTextAtSize(t, titleSizePt);
      const aw = authorFont.widthOfTextAtSize(a, authorSizePt);
      const cxPt = mmToPt(frontX + trim.widthMm / 2);
      const cyPt = mmToPt(totalH - totalH / 2);
      page.drawText(t, { x: cxPt - tw / 2, y: cyPt, size: titleSizePt, font: titleFont, color: rgb(1, 1, 1) });
      page.drawText(a, { x: cxPt - aw / 2, y: cyPt - mmToPt(trim.widthMm * 0.05), size: authorSizePt, font: authorFont, color: rgb(1, 1, 1) });
    }
  }

  return doc.save();
}
