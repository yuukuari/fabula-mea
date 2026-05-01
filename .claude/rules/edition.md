---
paths:
  - "src/pages/edition/**"
  - "src/components/edition/**"
  - "src/lib/export-*.ts"
  - "src/lib/pdf/**"
  - "src/lib/print-edition.ts"
  - "src/lib/cover-*.ts"
  - "src/lib/conformity.ts"
  - "src/store/useReaderStore.ts"
---

# Module Édition

Groupe top-level dans la sidebar (après Suivi) avec 6 sous-pages dans `src/pages/edition/`. Sépare ce qui est **commun** (mise en page, couvertures), **spécifique papier**, et **spécifique numérique**.

## Pages

- **`/edition`** — `EditionOverviewPage` : stepper 5 étapes (statut ✓/○ + résumé dynamique) + aperçu 3D. `BookReader` est globalisé (voir « Mode lecture » plus bas) ; cette page utilise `useReaderStore.openReader()`.
- **`/edition/layout`** — `EditionLayoutPage` : police, taille, interligne + aperçu live. Auto-save. Modale `LayoutChangeInfoDialog` (seul le texte « par défaut » est affecté).
- **`/edition/covers`** — `EditionCoversPage` : upload 1ère/4ème/dos via `CoverSection`. Aperçu déplié `CoverFlatPreview`.
- **`/edition/print`** — `EditionPrintPage` : 4 sections pliables auto-save. Réutilise `wizard/Step*`. Récap en bas avec 4 métriques.
- **`/edition/digital`** — `EditionDigitalPage` : description, mots-clés, ISBN 10/13, langue ISO 639-1, licence (8 radio cards).
- **`/edition/export`** — `EditionExportPage` : rapport conformité + exports groupés (numériques / impression papier).

## Trim sizes (`TRIM_SIZES`)

Réorganisés en deux groupes dans `print-edition.ts` (champ `classic: boolean`). UI dans `StepTrimSize` : classiques visibles d'emblée, autres derrière un toggle « Autres formats ».

- **Classiques (FR)** : `poche` 108×178, `roman` 140×205 (**défaut**), `grand_format` 155×240, `a5` 148×210
- **Autres** : `6x9` (Trade US), `royal` 156×234 (UK), `digest` 140×216 (US)

`DEFAULT_PRINT_EDITION.trimSize = 'roman'` ; `DEFAULT_MARGINS` couvre tous les ids. Le copy hint dans `EditionPrintPage` mentionne « Roman, blanc 80g ».

## Couvertures — 2 modes (`CoverMode`)

### Simplifié (défaut)
1ère + 4ème uniquement. Dos auto-composé : couleur unie + titre/auteur vertical. Paramètres : couleur, police, **orientation par défaut `btt` (européen, premier bouton à gauche)**, `ttb` (KDP) à droite. Titre désactivé si dos < `SPINE_MIN_TEXT_MM = 6 mm`.

### Avancé
Image unique = couverture dépliée. Éditeur d'overlays (`CoverAdvancedEditor`) : drag/resize/rotation, coordonnées en %.

### Tailles de polices titre/auteur (fallback sans image)

Aperçu et export PDF alignés : titre = `0.06 × frontWidth`, auteur = `0.03 × frontWidth`. Modifier l'un sans l'autre = incohérence visible.

### Exports couverture
- `exportCoverFinal` (HTML + window.print) — utilisé par le bouton « Couverture finale »
- `buildCoverPdfBytes` (`src/lib/pdf/cover.ts`) — bytes natifs pdf-lib, utilisé dans le ZIP impression. **Mode avancé : seul le flat est dessiné**, les overlays texte ne sont PAS re-rendus (à baker dans l'image).
- `exportCoverTemplate` — gabarit vierge avec guides

## fontSize des overlays

Convention : « CSS px à l'échelle 1:1 96 DPI » (1 px ≈ 0.2646 mm). Renderers scale : `canvas_font_px = stored × (canvasWidthPx / totalWidthMm) × 0.2646`. Dans SVG `<text>` à viewBox en mm : valeurs unitless. NE JAMAIS utiliser `mm` dans un foreignObject (× 3.78).

## BookPreview3D

Mode avancé : CSS `backgroundImage/Size/Position` pour clipper le flat. **Formule cruciale** : `backgroundPosition` est calculé par `startMm / (totalWidth - containerWidth) × 100`, PAS `startMm / containerWidth`. Le pourcentage CSS s'applique à l'écart `(container - image)` quand l'image est plus grande. Vertical : 50% (trim centré entre les bleeds).

## Mode lecture (BookReader) — globalisé

`useReaderStore` (Zustand) pilote l'ouverture. `BookReader` est monté dans `AppShell`, accessible depuis :
- pilule « Mode lecture » dans `EditorTabs` (bas centre, z-`[10000]` au-dessus du reader z-9999)
- bouton « Feuilleter » dans `EncyclopediaPage` et `BookPreview3D` → `openReader()`

**Mode écriture / Mode lecture mutuellement exclusifs** : ouvrir l'un ferme l'autre. `Mode lecture` visible seulement si au moins une scène a du contenu non-vide.

### 3 modes d'affichage
- `flip` (page-flip) avec chevrons gauche/droite (`invisible` aux extrémités via `currentPage`)
- `grid` (thumbnails) — clic miniature → bascule en taille réelle
- `actual-size` (96 DPI + `PageRuler`)

### Look & feel
Palette parchment (cohérent avec SceneEditor) — fond `bg-parchment-50`, bordures `border-parchment-200`, ModeButton actif blanc + bordeaux. Sélecteur de mode reste en haut, astuce clavier en haut aussi (la pilule occupe le bas).

### Marges alternées dans le rendu
`isVerso = pageNumber > 0 && pageNumber % 2 === 0`. Couvertures/pages blanches = recto. Pagination : `charsPerPage` × 0.88.

## Pipeline PDF (pdf-lib)

`window.print()` abandonné. Le PDF est généré avec **pdf-lib** côté client, marges au mm exactes.

### Modules `src/lib/pdf/`

- `types.ts` — `Block` / `InlineRun`
- `parse-html.ts` — TipTap HTML → blocks (gras/italique/souligné, h1-h3, hr, blockquote, ul/ol)
- `fonts.ts` — embarquement TTF via fontkit. Crimson Text, Lora, Merriweather, EB Garamond, Libre Baskerville fetched depuis jsDelivr (mirror Google Fonts). Times New Roman / Georgia / Garamond → fallback Times built-in (WinAnsi). Cache `fontBytesCache` + `safeText()` qui sanitize seulement pour les built-in.
- `layout.ts` — `Paginator` : flux de texte, justification, marges alternées, sauts forcés en recto, padding multiple de 4
- `cover.ts` — embed images avec **canvas-crop préalable** (pas de débordement sur la tranche), rendu des overlays texte mode avancé (rotation, alignement, italique/bold via variantes Times)
- `document.ts` — orchestration : couverture + page de titre + copyright + TOC + front/back matter + chapitres + glossaire

### API publique (`src/lib/export-pdf.ts`)

- `exportPdf(book)` → un PDF unique pour lecture (couvertures pleine page, marges identiques recto/verso)
- `exportPdfPrint(book)` → ZIP `Titre-impression.zip` avec `interieur.pdf` (sans couvertures, marges alternées, multiple de 4) + `couverture.pdf` (4ème + dos + 1ère, fond perdu) + `LISEZMOI.txt`

### Pagination

Numérotation typographique : pas de numéro sur couverture / page de titre / copyright / TOC. Compteur démarre à 1 sur le chapitre 1 (`Paginator.startBodyNumbering()`).

### Table des matières (TOC)

Stratégie en deux passes :
1. **Au rendu** : le label seul est dessiné, et la position Y (`cursorYMm`) + `pageIndex` sont capturés dans `tocRows[]`.
2. **Après pagination** : `paintTocLeaders()` dessine pour chaque entrée le **leader pointillé** (tile de `". "` calculé via `widthOfTextAtSize`) et le **numéro aligné à droite**. Si l'entrée n'a pas de numéro (front matter dont l'anchor `pageIndex < bodyStartIndex`), pas de leader non plus → ligne orpheline propre.

### Centrage du texte tournant (dos de couverture)

`pdf-lib.drawText({rotate})` tourne autour de l'ancre (baseline-gauche en coords locales). Pour centrer visuellement à `(cx, cy)` :
- `anchor_x = cx + sign(rotation) · 0.3 · fontSize`
- `anchor_y = cy − sign(rotation) · textWidth/2`

Le `0.3 · fontSize` correspond au décalage baseline → milieu visuel pour une serif typique.

### Polices custom dans les exports

- **PDF** : 5 polices embarquées via TTF (Crimson, Lora, Merriweather, EB Garamond, Libre Baskerville) — fetched depuis jsDelivr. Times/Georgia/Garamond → Times built-in.
- **EPUB** : mêmes polices ajoutées dans `OEBPS/fonts/` + `@font-face` dans `style.css` + manifest entries (media-type `application/font-sfnt`).
- **DOCX** : référence par nom (`getDocxFontName`) ; pas d'embed (ODTTF nécessite post-traitement zip + obfuscation, en plus de licences variables). Word/LibreOffice substitue si la police n'est pas installée.

### Limitations v1

- Pas de notes de bas de page.
- Mode avancé sans `flatImage` : les overlays sont dessinés sur fond `coverColor` (pas d'image fournie).
- Overlays utilisent les variantes Times built-in pour l'instant (pas la `fontFamily` choisie par overlay) — à raffiner si besoin.

## Couvertures dans les exports

`resolveCoverForExport` (`cover-for-export.ts`) : simplifié → image directe ; avancé → crop Canvas + overlays. CORS prod : Vercel Blob `Access-Control-Allow-Origin: *`. Les exports préfèrent `resolvedCoverFront/Back`.

## Marges alternées dans les exports

- **PDF** : géré côté `Paginator` (paramètre `alternateMargins`)
- **DOCX** : post-traitement JSZip → `<w:mirrorMargins/>`
- **EPUB** : pas d'alternance (reflowable)

## Rapport de conformité

`checkConformity(input)` retourne ~15 checks (titre, auteur, contenu, mise en page, marges, fond perdu, ISBN, multiple de 4, couvertures, métadonnées). UI dans `EditionExportPage`.

## Estimation des pages

`getSmartPageEstimate` (`calculations.ts`) → délègue à `estimatePageCount` si `printEdition` configuré, sinon fallback `getPageEstimate` (~250 mots/page).
