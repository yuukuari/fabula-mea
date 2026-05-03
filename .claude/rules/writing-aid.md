---
paths:
  - "src/components/writing-aid/**"
  - "src/lib/writing-aid/**"
  - "src/store/useWritingAidStore.ts"
  - "src/lib/cnrtl.ts"
---

# Aide à l'écriture

Panneau latéral droit du `SceneEditor`, **mutuellement exclusif** avec le panneau Notes (`SelfCommentPanel`). Une seule des deux icônes du header peut être active à la fois (`MessageCircle` pour Notes, `Wand2` pour Aide). État local : `rightPanel: 'none' | 'notes' | 'aid'`.

## Deux onglets

- **Outils** — accès libre, aucune analyse globale requise
  - **Répétitions** : détection regroupée par lemme léger (`lightStem`), avec scope sélectionnable. Filtrage par **concentration locale** (fenêtre glissante de 500 mots, défaut `minWindowCount=3`) — les répétitions diluées sur tout un livre ne sont pas signalées. Chaque item affiche son `count` total et, si la concentration est inférieure au total, un indicateur `N/500`. Cliquer un mot → surligne toutes les occurrences dans les scènes du scope + barre de navigation `< Ch.X · Scène Y >` qui pilote `focusedHit` et fait défiler la scène jusqu'à l'occurrence ciblée.
  - **Synonymes** : pill dédiée — input libre, scrape CNRTL via `fetchCnrtl` (module partagé `src/lib/cnrtl.ts` — utilisé aussi par le menu contextuel du correcteur).
  - **Antonymes** : pill dédiée, même mécanique avec `kind: 'antonymie'`.
  - **Figures de style** : bibliothèque statique (`STYLE_FIGURES`, ~20 figures) avec définition courte/longue, **rôle (« À quoi ça sert »)**, **cas concrets**, **paires Avant/Après commentées**, et exemples littéraires. Recherche live.
- **Analyse** — rapport global avec scores 0-100 par dimension + score global moyen.
  - 5 dimensions : Répétitions, Adverbes en -ment, Verbes ternes, Longueur des phrases, Variabilité lexicale.
  - Chaque score est dérivé d'une densité observée vs deux seuils (idéal / gênant) via `rangeScore`.
  - Sections dépliables : Répétitions / Adverbes / Verbes ternes utilisent `NavigableList` → mêmes pills cliquables que dans l'onglet Outils, avec surbrillance + navigation.
  - Phrases longues : top-10, clic → surbrillance de la phrase + scroll précis (via `focusedSentence` dans le store et recherche brute du texte dans le doc PM, avec fallback sur les 40 premiers caractères si l'inline-formatting coupe le match). Pas de navigation prev/next (une phrase = une occurrence).
  - Variabilité lexicale : juste des stats.

## Scope d'analyse (`AnalysisScope`)

`{ kind: 'scene' | 'chapter' | 'book' }`. Sélecteur 3 boutons, défaut **Scène courante** (celle visible dans l'éditeur). Mémorisé dans `useWritingAidStore`.

## Icônes contextuelles (auto-run)

Dans le rendu du manuscrit (`SceneEditor`) :
- `<ScanText>` à côté du **select de statut de scène** → analyse cette scène.
- `<ScanText>` à côté du **titre de chapitre** (visible au hover de la ligne) → analyse ce chapitre.

Comportement : ouvre le panneau Aide (`setRightPanel('aid')`), force l'onglet `report`, programme un `requestAutoRun(scope)` consommé par `ReportTab` au mount/update.

## Surbrillance & navigation hit-par-hit

`useWritingAidStore` expose deux états globaux :
- `highlight: { words, sceneIds, nonce }` — mots à colorer, restreints aux scènes du scope.
- `focusedHit: { sceneId, occurrenceIndex, nonce }` — occurrence active (style renforcé + scrollIntoView).

`WritingAidHighlightExtension` (`src/lib/writing-aid/highlight-extension.ts`) est un plugin ProseMirror configuré par scène (`{ sceneId }`). Il :
1. S'abonne au store via `useWritingAidStore.subscribe`.
2. Recompute un `DecorationSet` à chaque changement de `highlight` / `focusedHit` / contenu (méta `pluginKey` pour forcer le rebuild).
3. Scanne le doc avec `\p{L}+`, normalise (`normalizeWord` = lowercase + accents NFD strippés) et décore les matches.
4. Pour la `n`-ème occurrence dans cette scène (si scène ciblée), ajoute `wa-highlight-active` puis `scrollIntoView` sur le DOM correspondant.

CSS : classes `.wa-highlight` (gold ~30 %) et `.wa-highlight-active` (gold ~75 % + outline bordeaux) dans `src/index.css`.

Le composant `HitNavigator` (dans `WritingAidPanel`) re-scanne **en direct** le texte des scènes ciblées (via `useBookStore.scenes` + `tiptapHtmlToPlainText`) pour calculer la liste des occurrences à chaque édition, puis pilote `< / >` autour de cette liste plate. L'index utilisateur est clampé via `safeIdx = min(idx, length-1)`, ce qui suffit (les handlers prev/next ré-alignent naturellement via le modulo). Le bouton `HitItem` togglé déclenche montage/démontage de `HitNavigator` qui pose et nettoie la surbrillance.

## Architecture

```
src/lib/writing-aid/
├── types.ts          — AnalysisScope, ScenePiece, hits, ReportResult
├── manuscript-text.ts — resolveScope() + agrégation HTML→texte (via tiptapHtmlToPlainText)
├── stopwords.ts      — liste FR + lightStem() (lemmatisation grossière)
├── repetitions.ts    — detectRepetitions() groupé par stem → RepetitionAnalysis { items, maxBurst, windowSize }
├── adverbs.ts        — detectAdverbs() (-ment, filtré par whitelist ADVERBS_FR)
├── adverbs-whitelist.ts — Set ADVERBS_FR (~1270 adverbes, généré depuis Lexique 3.83)
├── dull-verbs.ts     — detectDullVerbs() — table forme→lemme (être, avoir, faire, dire, mettre, voir, prendre, aller)
├── sentences.ts      — analyzeSentences() — découpe d'abord par paragraphe (\n) puis par .!?… ; top-10 plus longues, ratio >30 mots
├── lexical.ts        — analyzeLexical() — ratio lemmes uniques / mots pleins
├── style-figures.ts  — STYLE_FIGURES (data statique)
├── report.ts         — buildReport() orchestrateur + rangeScore() + STAGE_LABELS
├── worker-client.ts  — Singleton Worker + API Promise (runReport, runRepetitions)
└── highlight-extension.ts — extension TipTap : surbrillance mots + phrases

src/workers/
└── writing-aid-worker.ts  — Web Worker bundlé séparément par Vite
```

## Web Worker

`buildReport` et `detectRepetitions` sont exécutés dans un **Web Worker** (`src/workers/writing-aid-worker.ts`) pour ne pas bloquer le thread principal sur les longs livres. Le worker est créé en singleton lazy via `src/lib/writing-aid/worker-client.ts` (`runReport`, `runRepetitions`) qui expose une API Promise + un callback `onProgress(stage, ratio)`.

**Corrélation par `requestId`** : chaque appel client incrémente un compteur et tag son message. Les listeners filtrent les réponses sur `msg.requestId === own`, sinon une analyse en cours pour la scène A pourrait résoudre la promesse de l'analyse B avec les données de A (ce qui était le bug « les stats du chapitre 2 sont identiques au chapitre 1 »).

Le report émet 7 stages (`resolve` → `repetitions` → `adverbs` → `dull-verbs` → `sentences` → `lexical` → `finalize`) avec ratio et libellé FR mappé via `STAGE_LABELS`. Le composant `ProgressBar` affiche barre + libellé courant pendant l'analyse.

Vite bundle le worker en chunk séparé (`writing-aid-worker-*.js`, ~10 kB).

## Points d'attention

1. **Module CNRTL** (`src/lib/cnrtl.ts`) extrait du `spellcheck-extension.ts` : si tu changes le scraping, vérifie les deux usages (panneau + menu contextuel).
2. **Scroll vers une occurrence (mots)** : pas de positionnement curseur exact. La surbrillance + `scrollIntoView` sur l'élément `.wa-highlight-active` suffit.
3. **Scroll vers une phrase** : recherche brute du texte dans le doc PM (extension), avec fallback sur la tête (40 premiers caractères) si l'inline-formatting coupe le match. Surligne la plage trouvée.
4. **Détection des adverbes** : approche **whitelist** via `ADVERBS_FR` (Set ~1270 entrées, généré depuis Lexique 3.83 — POS=ADV + suffixe -ment). Un mot en -ment absent de la whitelist est ignoré (donc plus de faux positifs sur les noms type *sifflement*, *moment*, *comment*…). Si un adverbe légitime manque, l'ajouter dans `adverbs-whitelist.ts`.
5. **Lemmatisation light** : `lightStem` est volontairement grossier (suffixes verbaux + pluriels). Pas de vraie lemmatisation pour éviter une grosse dépendance. Conséquence : quelques regroupements imparfaits sur les irréguliers.
6. **Score Répétitions** : basé sur le **maxBurst global** (`detectRepetitions` retourne `RepetitionAnalysis = { items, maxBurst, windowSize }`). `maxBurst` = nombre maximal d'occurrences répétées **toutes confondues** dans la fenêtre la plus dense. La densité est `maxBurst / windowSize`, ce qui pénalise correctement un paragraphe saturé même si le reste du texte est propre (un paragraphe dupliqué 4 fois cumule TOUTES ses répétitions dans la même fenêtre). Seuils : idéal 2 %, gênant 10 %.
7. **Découpage des phrases** : `analyzeSentences` découpe **d'abord par paragraphe** (`/[^\n]+/g` sur le texte plain), puis par ponctuation `.!?…` à l'intérieur. Sans ce double découpage, un titre sans ponctuation finale (ex. « Contexte ») se collait au paragraphe suivant et la recherche brute du clic-pour-scroller échouait (le texte concaténé n'existait pas dans le doc PM).
8. **Aide contextuelle** : `DIMENSION_HELP` dans `report.ts` centralise les textes (qu'est-ce que c'est, seuils, pistes d'amélioration) affichés en tête de chaque section dépliée du rapport via `DimensionHelpBlock`.
9. **Mutualité Notes / Aide** : si tu ajoutes un 3ᵉ panneau latéral, étends le type `RightPanel` plutôt que de multiplier les flags.
