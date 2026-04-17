/**
 * Generates a printable "briefing" document for a print-on-demand printer.
 * Contains all the book characteristics, checklist of files to send, and
 * platform-specific instructions (Coollibri, KDP, IngramSpark, Lulu).
 * The user opens it in a new window and prints to PDF.
 */
import type { BookLayout, DigitalEdition, PrintEdition } from '@/types';
import { getTrimSize, getPaperType, calculateSpineWidth, calculateCoverDimensions, estimatePageCount } from './print-edition';
import { DEFAULT_LAYOUT } from './fonts';

export interface PrinterBriefInput {
  title: string;
  author: string;
  genre?: string;
  layout?: BookLayout;
  wordCount: number;
  chapterCount: number;
}

function rightsLabel(rights?: string): string {
  const map: Record<string, string> = {
    all_rights_reserved: 'Tous droits réservés',
    cc_by: 'Creative Commons BY 4.0',
    cc_by_sa: 'Creative Commons BY-SA 4.0',
    cc_by_nc: 'Creative Commons BY-NC 4.0',
    cc_by_nc_sa: 'Creative Commons BY-NC-SA 4.0',
    cc_by_nd: 'Creative Commons BY-ND 4.0',
    cc_by_nc_nd: 'Creative Commons BY-NC-ND 4.0',
    public_domain: 'Domaine public',
  };
  return rights && map[rights] ? map[rights] : '—';
}

export function exportPrinterBrief(input: PrinterBriefInput): void {
  const { title, author, genre, layout, wordCount, chapterCount } = input;
  const pe: PrintEdition | undefined = layout?.printEdition;
  const de: DigitalEdition | undefined = layout?.digitalEdition;

  if (!pe) {
    alert("Configurez d'abord l'édition papier dans la section « Édition papier ».");
    return;
  }

  const trim = getTrimSize(pe.trimSize);
  const paper = getPaperType(pe.paperType);
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const pageCount = estimatePageCount(wordCount, pe.trimSize, fontSize, lineHeight, pe.margins, chapterCount);
  const spine = calculateSpineWidth(pageCount, pe.paperType);
  const dims = calculateCoverDimensions(pe.trimSize, pageCount, pe.paperType, pe.bleedMm);
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const win = window.open('', '_blank');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups ne sont pas bloqués.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Dossier imprimeur — ${esc(title)}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #2c2417;
      line-height: 1.55;
      max-width: 170mm;
      margin: 0 auto;
      padding: 10mm;
      font-size: 10.5pt;
    }
    h1 {
      font-size: 22pt;
      color: #7a1b3a;
      margin: 0 0 4pt;
      border-bottom: 2px solid #7a1b3a;
      padding-bottom: 6pt;
    }
    h2 {
      font-size: 14pt;
      color: #7a1b3a;
      margin: 20pt 0 6pt;
      border-bottom: 1px solid #d4c5a9;
      padding-bottom: 3pt;
    }
    h3 { font-size: 11pt; color: #2c2417; margin: 12pt 0 4pt; }
    .subtitle { color: #666; font-style: italic; margin: 0 0 16pt; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6pt 0;
      font-size: 10pt;
    }
    td { padding: 4pt 8pt; border-bottom: 1px solid #e8dcc8; vertical-align: top; }
    td:first-child { width: 45%; color: #666; }
    td:last-child { font-weight: 500; }
    ul { margin: 6pt 0; padding-left: 18pt; }
    li { margin: 3pt 0; }
    .checklist li {
      list-style: none;
      padding-left: 20pt;
      position: relative;
    }
    .checklist li::before {
      content: "☐";
      position: absolute;
      left: 0;
      font-size: 13pt;
      color: #7a1b3a;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #7a1b3a;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .print-btn:hover { background: #5a1329; }
    @media print { .print-btn { display: none; } }
    .platform-card {
      background: #fafaf5;
      border-left: 3px solid #7a1b3a;
      padding: 10pt 14pt;
      margin: 8pt 0;
      font-size: 9.5pt;
    }
    .platform-card h3 { margin-top: 0; color: #7a1b3a; }
    .warning {
      background: #fef9ec;
      border: 1px solid #f5d682;
      padding: 10pt 14pt;
      border-radius: 4pt;
      margin: 10pt 0;
      font-size: 9.5pt;
    }
    .tag { display: inline-block; background: #f0e6d2; color: #5a4e1e; padding: 2pt 6pt; border-radius: 3pt; font-size: 8.5pt; font-weight: 500; margin-right: 4pt; }
    .meta-footer { margin-top: 30pt; padding-top: 10pt; border-top: 1px solid #d4c5a9; font-size: 8.5pt; color: #999; text-align: center; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>

  <h1>Dossier imprimeur</h1>
  <p class="subtitle">« ${esc(title)} » — ${esc(author || 'Auteur inconnu')}${genre ? ` · ${esc(genre)}` : ''}</p>

  <h2>Caractéristiques du livre</h2>
  <table>
    <tr><td>Titre</td><td>${esc(title)}</td></tr>
    <tr><td>Auteur</td><td>${esc(author || '—')}</td></tr>
    ${genre ? `<tr><td>Genre</td><td>${esc(genre)}</td></tr>` : ''}
    <tr><td>Nombre de mots</td><td>${wordCount.toLocaleString('fr-FR')}</td></tr>
    <tr><td>Nombre de chapitres</td><td>${chapterCount}</td></tr>
  </table>

  <h2>Spécifications d'impression</h2>
  <table>
    <tr><td>Format (trim)</td><td><b>${trim.label}</b> — ${trim.widthMm} × ${trim.heightMm} mm</td></tr>
    <tr><td>Papier intérieur</td><td>${paper.label} (${paper.thicknessMm} mm / feuille)</td></tr>
    <tr><td>Marges (haut / bas / intérieur / extérieur)</td><td>${pe.margins.topMm} / ${pe.margins.bottomMm} / ${pe.margins.innerMm} / ${pe.margins.outerMm} mm</td></tr>
    <tr><td>Fond perdu</td><td>${pe.bleedMm} mm sur chaque côté</td></tr>
    <tr><td>Nombre de pages estimé</td><td>~${pageCount} pages</td></tr>
    <tr><td>Largeur du dos (estimation ±10 %)</td><td>~${spine} mm · à vérifier avec votre imprimeur</td></tr>
    <tr><td>Dimensions couverture dépliée</td><td>${dims.totalWidthMm} × ${dims.totalHeightMm} mm</td></tr>
    ${pe.isbn ? `<tr><td>ISBN (papier)</td><td>${esc(pe.isbn)}</td></tr>` : ''}
    ${pe.publisher ? `<tr><td>Éditeur</td><td>${esc(pe.publisher)}</td></tr>` : ''}
    ${pe.printDate ? `<tr><td>Date prévue d'impression</td><td>${esc(pe.printDate)}</td></tr>` : ''}
    <tr><td>Typographie</td><td>${layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily} · ${layout?.fontSize ?? DEFAULT_LAYOUT.fontSize} pt · interligne ${layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight}</td></tr>
  </table>

  ${de && (de.description || de.isbnDigital || de.rights) ? `
  <h2>Métadonnées numériques</h2>
  <table>
    ${de.isbnDigital ? `<tr><td>ISBN (numérique)</td><td>${esc(de.isbnDigital)}</td></tr>` : ''}
    ${de.language ? `<tr><td>Langue</td><td>${esc(de.language)}</td></tr>` : ''}
    ${de.publisher ? `<tr><td>Éditeur numérique</td><td>${esc(de.publisher)}</td></tr>` : ''}
    ${de.rights ? `<tr><td>Licence</td><td>${esc(rightsLabel(de.rights))}</td></tr>` : ''}
    ${de.keywords && de.keywords.length > 0 ? `<tr><td>Mots-clés</td><td>${de.keywords.map((k) => `<span class="tag">${esc(k)}</span>`).join('')}</td></tr>` : ''}
  </table>
  ${de.description ? `<h3>Description</h3><p>${esc(de.description).replace(/\n/g, '<br/>')}</p>` : ''}
  ` : ''}

  <h2>Fichiers à envoyer à l'imprimeur</h2>
  <ul class="checklist">
    <li><b>PDF intérieur</b> — généré via « PDF prêt à imprimer » dans Fabula Mea. Dimensions : ${trim.widthMm} × ${trim.heightMm} mm.</li>
    <li><b>PDF couverture</b> — une couverture à plat (${dims.totalWidthMm} × ${dims.totalHeightMm} mm) incluant 4ème + dos + 1ère + fond perdu de ${pe.bleedMm} mm.</li>
    <li><b>Ce dossier</b> (PDF) — résumé des caractéristiques pour votre correspondant imprimeur.</li>
  </ul>

  <div class="warning">
    <b>Avant envoi :</b>
    <ul>
      <li>Vérifiez que le nombre de pages intérieur est un multiple de 4 (cahier d'impression).</li>
      <li>Aplatissez les guides du gabarit de couverture s'ils sont encore visibles.</li>
      <li>Intégrez toutes les polices dans le PDF (option « Embed fonts » dans votre logiciel).</li>
      <li>Exportez en résolution 300 DPI minimum pour les images.</li>
      <li>Vérifiez le rendu CMYK si votre imprimeur le demande (Fabula Mea génère du RGB par défaut).</li>
    </ul>
  </div>

  <h2>Instructions par plateforme</h2>

  <div class="platform-card">
    <h3>Coollibri</h3>
    <p>Format ${trim.widthMm}×${trim.heightMm} mm disponible pour Dos Carré Collé. Téléversez le PDF intérieur et le PDF couverture séparément depuis l'étape 2 et 3 du workflow. Minimum 24 pages.</p>
  </div>

  <div class="platform-card">
    <h3>Amazon KDP</h3>
    <p>Compte « KDP Print » sur kdp.amazon.com. Le format ${trim.widthMm}×${trim.heightMm} mm ${trim.widthMm === 148 && trim.heightMm === 210 ? 'correspond à « 5.83 × 8.27 inch »' : 'doit être configuré en format personnalisé'}. Marge intérieure (gouttière) recommandée ≥ ${pe.margins.innerMm >= 15 ? pe.margins.innerMm : 15} mm. ISBN fourni gratuitement par KDP (sinon utilisez le vôtre).</p>
  </div>

  <div class="platform-card">
    <h3>IngramSpark</h3>
    <p>Plateforme professionnelle qui distribue aussi en librairie physique. Exige un ISBN personnel. Minimum 18 pages, maximum 1200. Fichier couverture à plat au format ${dims.totalWidthMm}×${dims.totalHeightMm} mm avec fond perdu ${pe.bleedMm} mm.</p>
  </div>

  <div class="platform-card">
    <h3>Lulu</h3>
    <p>Supporte les formats personnalisés. Permet la distribution Amazon/IngramSpark depuis un seul upload. Pas de minimum de tirage. L'outil de validation automatique vérifie le PDF avant commande.</p>
  </div>

  <div class="meta-footer">
    Document généré le ${today} par Fabula Mea
  </div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!);
}
