/**
 * Generates a printable cover template with guide lines (bleed, safety zone,
 * spine) at the exact physical dimensions defined by the book's printEdition.
 * The user opens it in a new window and prints to PDF.
 *
 * The template is a single landscape page sized to cover (back + spine + front
 * + bleeds) so designers can use it as a base in their graphics software.
 */
import type { BookLayout } from '@/types';
import { getTrimSize, calculateSpineWidth, calculateCoverDimensions, DEFAULT_PRINT_EDITION } from './print-edition';

export function exportCoverTemplate(layout: BookLayout | undefined, title: string, pageCount: number): void {
  const pe = layout?.printEdition ?? DEFAULT_PRINT_EDITION;
  const trim = getTrimSize(pe.trimSize);
  const spine = calculateSpineWidth(pageCount, pe.paperType);
  const dims = calculateCoverDimensions(pe.trimSize, pageCount, pe.paperType, pe.bleedMm);
  const safetyMm = 5; // safety zone inside each trim area

  const win = window.open('', '_blank');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups ne sont pas bloqués.");
    return;
  }

  // Compute positions (left origin) in mm along the total width
  const bleed = pe.bleedMm;
  const backStart = bleed;
  const backEnd = backStart + trim.widthMm;
  const spineStart = backEnd;
  const spineEnd = spineStart + spine;
  const frontStart = spineEnd;
  const frontEnd = frontStart + trim.widthMm;

  const totalW = dims.totalWidthMm;
  const totalH = dims.totalHeightMm;
  const trimTop = bleed;
  const trimBottom = totalH - bleed;

  // Helper to make px from mm at 96 DPI (for preview on screen)
  const pxPerMm = 96 / 25.4;
  const totalWpx = totalW * pxPerMm;
  const totalHpx = totalH * pxPerMm;

  const safeLeft = (x: number) => x + safetyMm;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(title)} — Gabarit de couverture</title>
  <style>
    @page {
      size: ${totalW}mm ${totalH}mm;
      margin: 0;
    }
    @media print {
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #e9e5d8;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .instructions {
      max-width: 800px;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
      color: #2c2417;
      background: white;
      border-radius: 8px;
      margin: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .instructions h1 {
      margin: 0 0 12px;
      font-size: 20px;
      color: #7a1b3a;
    }
    .instructions ul { margin: 8px 0; padding-left: 20px; }
    .instructions li { margin: 4px 0; }
    .instructions .legend {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 12px 0;
    }
    .instructions .legend > div {
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .instructions .legend .red-line { border-left: 3px solid #e53e3e; padding-left: 10px; color: #742a2a; }
    .instructions .legend .green-line { border-left: 3px dashed #059669; padding-left: 10px; color: #064e3b; }
    .instructions .legend .blue-line { border-left: 3px dashed #3b82f6; padding-left: 10px; color: #1e3a8a; }
    .print-btn {
      background: #7a1b3a;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      margin-bottom: 16px;
    }
    .print-btn:hover { background: #5a1329; }
    .cover-preview {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12);
      margin: 0 24px 24px;
      max-width: calc(100vw - 48px);
      overflow: auto;
    }
    svg.cover {
      display: block;
    }
    @media print {
      body { background: white; margin: 0; padding: 0; }
      .cover-preview { box-shadow: none; padding: 0; margin: 0; border-radius: 0; max-width: none; overflow: visible; }
      svg.cover { width: ${totalW}mm; height: ${totalH}mm; }
    }
  </style>
</head>
<body>
  <div class="instructions no-print">
    <h1>Gabarit de couverture — ${escapeHtml(title)}</h1>
    <p>
      Ce gabarit est configuré aux dimensions exactes de votre édition papier :
      <b>${totalW} × ${totalH} mm</b> (couverture dépliée : 4ème + dos + 1ère + fond perdu de ${bleed} mm).
    </p>
    <p>Suggestions d'utilisation :</p>
    <ul>
      <li>Imprimez ce gabarit en PDF (bouton ci-dessous) et importez-le dans Photoshop, GIMP, Canva, Affinity…</li>
      <li>Placez votre design en respectant les zones indiquées par les guides colorés.</li>
      <li>Aplatissez les guides avant export final (ils ne doivent pas apparaître dans le PDF envoyé à l'imprimeur).</li>
    </ul>

    <div class="legend">
      <div class="red-line"><b>Ligne rouge</b> — Zone de coupe. Votre visuel doit dépasser jusqu'au bord rouge pour éviter les bandes blanches après découpe.</div>
      <div class="green-line"><b>Pointillés verts</b> — Zone de sécurité (5 mm). Tout texte ou élément important doit rester à l'intérieur.</div>
      <div class="blue-line"><b>Pointillés bleus</b> — Dos du livre (${spine} mm de large, calculé pour ${pageCount} pages). Placez le titre vertical ici si le dos est assez large.</div>
    </div>
    <button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  </div>

  <div class="cover-preview">
    <svg class="cover" width="${totalWpx}" height="${totalHpx}" viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <!-- White background -->
      <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="white" />

      <!-- Bleed area border (red) -->
      <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="none" stroke="#e53e3e" stroke-width="0.3" />

      <!-- Trim line (red solid) -->
      <rect x="${bleed}" y="${bleed}" width="${trim.widthMm * 2 + spine}" height="${trim.heightMm}" fill="none" stroke="#e53e3e" stroke-width="0.5" />

      <!-- Safety zone (green dashed) inside back cover -->
      <rect x="${safeLeft(backStart)}" y="${trimTop + safetyMm}" width="${trim.widthMm - 2 * safetyMm}" height="${trim.heightMm - 2 * safetyMm}" fill="none" stroke="#059669" stroke-width="0.3" stroke-dasharray="2 1" />

      <!-- Safety zone (green dashed) inside front cover -->
      <rect x="${safeLeft(frontStart)}" y="${trimTop + safetyMm}" width="${trim.widthMm - 2 * safetyMm}" height="${trim.heightMm - 2 * safetyMm}" fill="none" stroke="#059669" stroke-width="0.3" stroke-dasharray="2 1" />

      <!-- Spine zone (blue dashed) -->
      <line x1="${spineStart}" y1="${trimTop}" x2="${spineStart}" y2="${trimBottom}" stroke="#3b82f6" stroke-width="0.4" stroke-dasharray="2 1" />
      <line x1="${spineEnd}" y1="${trimTop}" x2="${spineEnd}" y2="${trimBottom}" stroke="#3b82f6" stroke-width="0.4" stroke-dasharray="2 1" />

      <!-- Spine safety zone -->
      ${spine > 4 ? `<rect x="${spineStart + 1}" y="${trimTop + safetyMm}" width="${spine - 2}" height="${trim.heightMm - 2 * safetyMm}" fill="none" stroke="#3b82f6" stroke-width="0.2" stroke-dasharray="1 1" opacity="0.6" />` : ''}

      <!-- Labels -->
      <text x="${(backStart + backEnd) / 2}" y="${totalH / 2}" text-anchor="middle" font-size="6" fill="#aaa" font-family="system-ui, sans-serif">4ème de couverture</text>
      <text x="${(backStart + backEnd) / 2}" y="${totalH / 2 + 4}" text-anchor="middle" font-size="3" fill="#bbb" font-family="system-ui, sans-serif">${trim.widthMm} × ${trim.heightMm} mm</text>

      ${spine > 6 ? `<text x="${spineStart + spine / 2}" y="${totalH / 2}" text-anchor="middle" font-size="${Math.min(spine * 0.4, 3)}" fill="#aaa" font-family="system-ui, sans-serif" transform="rotate(-90 ${spineStart + spine / 2} ${totalH / 2})">Dos — ${spine} mm</text>` : ''}

      <text x="${(frontStart + frontEnd) / 2}" y="${totalH / 2}" text-anchor="middle" font-size="6" fill="#aaa" font-family="system-ui, sans-serif">1ère de couverture</text>
      <text x="${(frontStart + frontEnd) / 2}" y="${totalH / 2 + 4}" text-anchor="middle" font-size="3" fill="#bbb" font-family="system-ui, sans-serif">${trim.widthMm} × ${trim.heightMm} mm</text>

      <!-- Cut marks on corners (4 short lines) -->
      <g stroke="#e53e3e" stroke-width="0.3">
        <!-- Top-left -->
        <line x1="0" y1="${bleed}" x2="${bleed - 1}" y2="${bleed}" />
        <line x1="${bleed}" y1="0" x2="${bleed}" y2="${bleed - 1}" />
        <!-- Top-right -->
        <line x1="${totalW}" y1="${bleed}" x2="${totalW - bleed + 1}" y2="${bleed}" />
        <line x1="${totalW - bleed}" y1="0" x2="${totalW - bleed}" y2="${bleed - 1}" />
        <!-- Bottom-left -->
        <line x1="0" y1="${trimBottom}" x2="${bleed - 1}" y2="${trimBottom}" />
        <line x1="${bleed}" y1="${totalH}" x2="${bleed}" y2="${trimBottom + 1}" />
        <!-- Bottom-right -->
        <line x1="${totalW}" y1="${trimBottom}" x2="${totalW - bleed + 1}" y2="${trimBottom}" />
        <line x1="${totalW - bleed}" y1="${totalH}" x2="${totalW - bleed}" y2="${trimBottom + 1}" />
      </g>

      <!-- Dimension annotations (top edge) -->
      <g font-family="system-ui, sans-serif" fill="#777">
        <text x="${bleed / 2}" y="${bleed - 0.5}" text-anchor="middle" font-size="2">${bleed}mm</text>
        <text x="${backStart + trim.widthMm / 2}" y="${bleed - 0.5}" text-anchor="middle" font-size="2">${trim.widthMm}mm (4ème)</text>
        <text x="${spineStart + spine / 2}" y="${bleed - 0.5}" text-anchor="middle" font-size="2">${spine}mm</text>
        <text x="${frontStart + trim.widthMm / 2}" y="${bleed - 0.5}" text-anchor="middle" font-size="2">${trim.widthMm}mm (1ère)</text>
        <text x="${totalW - bleed / 2}" y="${bleed - 0.5}" text-anchor="middle" font-size="2">${bleed}mm</text>
      </g>
    </svg>
  </div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!);
}
