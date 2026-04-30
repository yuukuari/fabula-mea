---
paths:
  - "src/pages/edition/**"
  - "src/components/edition/**"
  - "src/lib/export-*.ts"
  - "src/lib/print-edition.ts"
  - "src/lib/cover-*.ts"
  - "src/lib/conformity.ts"
---

# Module Édition

Groupe top-level dans la sidebar (après Suivi) avec 6 sous-pages dans `src/pages/edition/`. Sépare ce qui est **commun** (mise en page, couvertures), **spécifique papier**, et **spécifique numérique**.

## Pages

- **`/edition`** — `EditionOverviewPage` : stepper 5 étapes (statut ✓/○ + résumé dynamique) + aperçu 3D. `BookReader` monté conditionnellement (`{readerOpen && <BookReader…/>}`) pour éviter la pagination à chaque re-render.
- **`/edition/layout`** — `EditionLayoutPage` : police, taille, interligne + aperçu live. Auto-save. Modale `LayoutChangeInfoDialog` (seul le texte « par défaut » est affecté). Déplacé depuis SettingsPage.
- **`/edition/covers`** — `EditionCoversPage` : upload 1ère/4ème/dos via `CoverSection`, schéma SVG si `printEdition` configuré. Bouton gabarit (`exportCoverTemplate`).
- **`/edition/print`** — `EditionPrintPage` : 4 sections pliables auto-save. Réutilise `wizard/Step*`. `HelpTrigger` → `PrintHelpModal` (topics: `bleed`, `safety`, `flat-cover`). Récap en bas avec 4 métriques.
- **`/edition/digital`** — `EditionDigitalPage` : description, mots-clés (tag input), ISBN validation 10/13, langue ISO 639-1, licence (8 radio cards). Auto-save.
- **`/edition/export`** — `EditionExportPage` : rapport conformité + exports groupés (numériques / impression papier).

## Couvertures — 2 modes (`CoverMode`)

### Simplifié (défaut)
Upload 1ère + 4ème uniquement. Dos auto-composé via `CoverSimplifiedConfig` : couleur unie + titre/auteur vertical. Paramètres : couleur, police, orientation (ttb KDP / btt européen). Titre désactivé si dos < `SPINE_MIN_TEXT_MM = 6 mm`. Aperçu SVG en temps réel via `CoverFlatPreview`.

### Avancé
Upload d'une seule image : couverture dépliée complète. Éditeur d'overlays texte (`CoverAdvancedEditor`) : drag/resize/rotation, coordonnées en pourcentages, implémentation vanilla. Touches : `Suppr`/`Backspace` = supprimer, `Escape` = désélectionner.

### Exports couverture
Quand `printEdition` configuré : « Couverture finale » (`exportCoverFinal`) et « Gabarit vierge » (`exportCoverTemplate`).

### `coverSpine` legacy
Reste dans `BookLayout` pour rétrocompat mais n'est plus exposé dans l'UI. Si présent, prend le dessus sur l'auto-composition.

## Dos & standards d'impression

`calculateSpineWidth(pageCount, paperType) = (pageCount / 2) × thicknessMm`. Épaisseurs alignées KDP/IngramSpark : blanc 80g = 0.0572 mm/page, crème 80g = 0.0635, blanc 90g = 0.065. Estimation ±10%. `SpineWidthTooltip` affiche l'avertissement partout. Sous 6 mm → badge + désactivation titre.

## fontSize des overlays

Convention : stocké en « CSS px à l'échelle 1:1 96 DPI » (1 px ≈ 0.2646 mm). Chaque renderer scale : `canvas_font_px = stored_fontSize × (canvasWidthPx / totalWidthMm) × 0.2646`. Dans `export-cover-final.ts` : SVG avec valeurs unitless (viewBox en mm) — ne JAMAIS utiliser le suffixe `mm` en CSS dans un foreignObject, provoque inflation × 3.78.

## BookReader — 3 modes

Toggle : `flip` (page-flip), `grid` (thumbnails → taille réelle), `actual-size` (taille physique 96 DPI + `PageRuler`).
- **Marges alternées** : `isVerso = pageNumber > 0 && pageNumber % 2 === 0`. Couvertures/pages blanches = recto.
- **Ombre du dos** : CSS `box-shadow: inset` sur `.stf__item > div` dans `index.css`.
- **Couverture avancée** : `ClippedFlatCover` clippe `CoverFlatPreview` aux dimensions du trim.
- **Page-flip + StrictMode** : `setTimeout(…, 0)` avec flag `aborted`.
- **Pagination** : `charsPerPage` applique facteur 0.88.

## BookPreview3D

Mode avancé : CSS `backgroundImage/Size/Position` pour clipper le flat. Mode simplifié : fallback `coverFront/Back/Spine` + rendu auto-composé. Source de vérité dos : `resolveSpineRender()` dans `cover-composition.ts`.

## Couvertures dans les exports

`resolveCoverForExport` (`cover-for-export.ts`) : simplifié → retourne directement les images ; avancé → crop via Canvas + overlays. CORS en prod : Vercel Blob sert `Access-Control-Allow-Origin: *`. Fallback si échec. Les 3 exports préfèrent `resolvedCoverFront/Back`.

## Marges alternées dans les exports

- **PDF** : `@page :right` / `:left` dans `export-pdf.ts`
- **DOCX** : post-traitement JSZip → `<w:mirrorMargins/>` dans `word/settings.xml`
- **EPUB** : pas d'alternance (reflowable)

## Rapport de conformité

`checkConformity(input)` retourne ~15 checks (titre, auteur, contenu, scènes incomplètes, mise en page, marges ≥ 15mm, fond perdu ≥ 3mm, ISBN, pages multiple de 4, couvertures, métadonnées…). `summarizeConformity` → `readyToExport` (aucune erreur). UI dans `EditionExportPage`.

## Estimation des pages

`getSmartPageEstimate` (`calculations.ts`) → si `printEdition` configuré, délègue à `estimatePageCount` (`print-edition.ts`) ; sinon fallback `getPageEstimate` (~250 mots/page). Filtrage chapitres « vrais » via `isSpecialChapter`.

## Vue d'ensemble — carte Édition

`EncyclopediaPage` : carte pleine largeur avec format + pages estimées, barre de progression 4 critères, bouton « Feuilleter » → `BookReader` overlay.

## Helpers

- `totalScenesCount(scenes, unit)` dans `utils.ts` — total mots/signes, utilisé dans les 6 pages et conformité
- `exportEpub` utilise `digitalEdition` en priorité avec fallback champs historiques
