/**
 * Generates the final print-ready cover PDF (flat cover with all designs
 * composed). Opens a new window sized to the exact physical cover dimensions
 * (back + spine + front + bleed) and uses window.print() to save as PDF.
 *
 * - Simplified mode: composes back image + solid-color spine (with optional
 *   vertical title/author) + front image.
 * - Advanced mode: uses the flat image as background + renders overlays on top.
 */
import type { BookLayout } from '@/types';
import { getTrimSize, calculateCoverDimensions, calculateSpineWidth, estimatePageCount } from './print-edition';
import { FONT_STACKS } from './fonts';
import { getCoverMode, getSimplifiedCover, getAdvancedCover, resolveSpineRender, resolveCoverColor, SPINE_MIN_TEXT_MM } from './cover-composition';

export interface CoverFinalInput {
  layout: BookLayout | undefined;
  title: string;
  author: string;
  /** Precomputed total word count. */
  wordCount: number;
  /** Real chapters count (excluding front/back matter). */
  chapterCount: number;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!);
}

export function exportCoverFinal(input: CoverFinalInput): void {
  const { layout, title, author, wordCount, chapterCount } = input;
  const pe = layout?.printEdition;
  if (!pe) {
    alert("Configurez d'abord l'édition papier pour générer la couverture.");
    return;
  }

  const trim = getTrimSize(pe.trimSize);
  const fontSize = layout?.fontSize ?? 12;
  const lineHeight = layout?.lineHeight ?? 1.5;
  const pageCount = estimatePageCount(wordCount, pe.trimSize, fontSize, lineHeight, pe.margins, chapterCount);
  const spine = calculateSpineWidth(pageCount, pe.paperType);
  const dims = calculateCoverDimensions(pe.trimSize, pageCount, pe.paperType, pe.bleedMm);
  const mode = getCoverMode(layout);

  const bleed = pe.bleedMm;
  const totalW = dims.totalWidthMm;
  const totalH = dims.totalHeightMm;
  const backX = bleed;
  const spineX = backX + trim.widthMm;
  const frontX = spineX + spine;
  const trimTop = bleed;
  const innerHeight = totalH - 2 * bleed;

  const win = window.open('', '_blank');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups ne sont pas bloqués.");
    return;
  }

  const coverColor = resolveCoverColor(layout);
  let coverSvgContent = '';

  if (mode === 'advanced') {
    const advanced = getAdvancedCover(layout);
    const flat = advanced.flatImage;
    if (flat) {
      coverSvgContent += `<image href="${flat}" x="0" y="0" width="${totalW}" height="${totalH}" preserveAspectRatio="xMidYMid slice" />`;
    } else {
      coverSvgContent += `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#f5f0e6"/>`;
    }
    // Overlays
    for (const o of advanced.overlays ?? []) {
      const ox = (o.xPct / 100) * totalW;
      const oy = (o.yPct / 100) * totalH;
      const ow = (o.widthPct / 100) * totalW;
      const oh = (o.heightPct / 100) * totalH;
      const cx = ox + ow / 2;
      const cy = oy + oh / 2;
      const fontStack = (FONT_STACKS as Record<string, string>)[o.fontFamily] ?? `'${o.fontFamily}', sans-serif`;
      // overlay.fontSize is in "CSS px at 96 DPI reference" (1 px ≈ 0.2646 mm).
      // In a foreignObject inside a viewBox whose user units are mm, 1 CSS px
      // of content == 1 user unit == 1 mm. So we express the font size in
      // CSS px equal to the real-world mm (fontSize * 0.2646). NEVER use the
      // `mm` CSS unit here — CSS `mm` is converted via 96 DPI and would inflate
      // the text by a factor of ~3.78.
      const fontSizeCssPx = o.fontSize * 0.2646;
      coverSvgContent += `
  <g transform="rotate(${o.rotation} ${cx} ${cy})">
    <foreignObject x="${ox}" y="${oy}" width="${ow}" height="${oh}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:${o.textAlign === 'left' ? 'flex-start' : o.textAlign === 'right' ? 'flex-end' : 'center'};font-family:${fontStack};font-size:${fontSizeCssPx}px;font-weight:${o.fontWeight};font-style:${o.fontStyle};color:${o.color};text-align:${o.textAlign};line-height:1.1;overflow:hidden;">
        ${escapeHtml(o.content)}
      </div>
    </foreignObject>
  </g>`;
    }
  } else {
    // Simplified mode
    // Back cover
    if (layout?.coverBack) {
      coverSvgContent += `<image href="${layout.coverBack}" x="${backX}" y="${trimTop}" width="${trim.widthMm}" height="${innerHeight}" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      coverSvgContent += `<rect x="${backX}" y="${trimTop}" width="${trim.widthMm}" height="${innerHeight}" fill="${coverColor}"/>`;
    }

    // Spine
    const spineRender = resolveSpineRender(layout, title, author, spine);
    const bookFontStack = (FONT_STACKS as Record<string, string>)[layout?.fontFamily ?? 'Times New Roman'] ?? "'Times New Roman', serif";
    const spineFontStack = (FONT_STACKS as Record<string, string>)[getSimplifiedCover(layout).spineFontFamily ?? (layout?.fontFamily ?? 'Times New Roman')] ?? bookFontStack;
    coverSvgContent += `<rect x="${spineX}" y="${trimTop}" width="${spine}" height="${innerHeight}" fill="${spineRender.color}"/>`;

    if (spineRender.showText && spine >= SPINE_MIN_TEXT_MM) {
      const label = author ? `${title} — ${author}` : title;
      // viewBox is in mm → use unitless user units (1 = 1 mm). Matches preview.
      const fontSizeMm = Math.max(spine * 0.45, 2);
      const cx = spineX + spine / 2;
      const cy = totalH / 2;
      const rot = spineRender.orientation === 'ttb' ? 90 : -90;
      coverSvgContent += `
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="${spineFontStack}" font-size="${fontSizeMm}" fill="${spineRender.textColor}" font-weight="600" transform="rotate(${rot}, ${cx}, ${cy})">${escapeHtml(label)}</text>`;
    }

    // Front cover
    if (layout?.coverFront) {
      coverSvgContent += `<image href="${layout.coverFront}" x="${frontX}" y="${trimTop}" width="${trim.widthMm}" height="${innerHeight}" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      coverSvgContent += `
  <rect x="${frontX}" y="${trimTop}" width="${trim.widthMm}" height="${innerHeight}" fill="${coverColor}"/>
  <text x="${frontX + trim.widthMm / 2}" y="${totalH / 2}" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="bold" font-size="${trim.widthMm * 0.06}mm" fill="#ffffff">${escapeHtml(title || 'Titre')}</text>
  <text x="${frontX + trim.widthMm / 2}" y="${totalH / 2 + trim.widthMm * 0.05}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="${trim.widthMm * 0.03}mm" fill="#ffffffaa">${escapeHtml(author || 'Auteur')}</text>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(title)} — Couverture finale</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: ${totalW}mm ${totalH}mm;
      margin: 0;
    }
    body { margin: 0; padding: 0; background: #e9e5d8; }
    .print-btn {
      position: fixed; top: 20px; right: 20px;
      background: #7a1b3a; color: white; border: none;
      padding: 10px 20px; border-radius: 6px;
      font-size: 14px; cursor: pointer; font-family: system-ui, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10;
    }
    .print-btn:hover { background: #5a1329; }
    .hint { position: fixed; top: 20px; left: 20px; font-family: system-ui, sans-serif; font-size: 13px; color: #555; background: white; padding: 8px 12px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); z-index: 10; max-width: 400px; }
    svg.cover {
      display: block;
      margin: 30px auto;
      background: white;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    }
    @media print {
      body { background: white; margin: 0; padding: 0; }
      .print-btn, .hint { display: none !important; }
      svg.cover { margin: 0; box-shadow: none; width: ${totalW}mm; height: ${totalH}mm; }
    }
  </style>
</head>
<body>
  <div class="hint">
    <b>Couverture dépliée ${totalW} × ${totalH} mm</b><br/>
    Imprimez en PDF puis envoyez à votre imprimeur.
  </div>
  <button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>

  <svg class="cover"
    width="${totalW * 2.5}" height="${totalH * 2.5}"
    viewBox="0 0 ${totalW} ${totalH}"
    xmlns="http://www.w3.org/2000/svg"
  >
    ${coverSvgContent}
  </svg>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
