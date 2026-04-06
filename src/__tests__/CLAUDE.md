# CLAUDE.md — Tests unitaires

## Vue d'ensemble

Tests unitaires **Vitest** pour les logiques critiques de l'application. Les tests portent sur la logique pure (pas de composants React, pas de DOM) et s'exécutent en environnement `node`.

## Configuration

- **Framework** : Vitest 1.x (compatible Vite 5)
- **Environnement** : `node` (pas de `jsdom` — tests de logique pure uniquement)
- **Config** : section `test` dans `vite.config.ts` (globals activés)
- **Commandes** : `npm test` (run), `npm run test:watch` (watch)

## Convention

Les tests répliquent la logique des fonctions internes (non exportées) pour les tester en isolation. C'est intentionnel : les fonctions comme `cloudSaveWithRetry`, `updateDailySnapshot`, ou la logique de version history sont des fonctions internes aux stores/modules qui ne sont pas exportées. On reproduit le même algorithme dans les tests pour valider le comportement sans coupler les tests à l'implémentation interne.

Si une fonction est refactorée, le test correspondant doit être mis à jour pour refléter la nouvelle logique.

## Fichiers de test

### `cloudSaveWithRetry.test.ts` — Retry avec backoff exponentiel

Teste le pattern de retry utilisé par `useBookStore.saveBook()` et `useSagaStore.saveSaga()` pour la sauvegarde cloud.

| Test | Description |
|------|-------------|
| Succès immédiat | `fn` réussit au 1er appel → retourne directement |
| Retry + succès | `fn` échoue puis réussit au 2e appel → 1s de délai |
| Échec total | `fn` échoue N fois → throw après maxRetries |
| Backoff exponentiel | Vérifie les délais : 1s (2⁰), 2s (2¹) entre tentatives |
| maxRetries custom | Paramètre configurable (défaut: 3) |

**Logique testée** (répliquée depuis `useBookStore.ts`) :
```typescript
async function cloudSaveWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}
```

**Note** : le test "Échec total" utilise `vi.useRealTimers()` car `vi.useFakeTimers()` avec des `Promise.reject` asynchrones cause des "unhandled rejection" parasites dans Vitest.

---

### `versionHistory.test.ts` — Historique de versions

Teste la logique de snapshots automatiques et de restauration, utilisée par `dev-db.ts` (dev) et `api/book/[bookId].ts` (prod).

#### `extractStats` (3 tests)

| Test | Description |
|------|-------------|
| Comptage book data | Chapters (type=chapter uniquement), scenes, events, words (somme currentWordCount), characters, places, worldNotes, maps, notes |
| Saga data prioritaire | Quand `sagaData` est fourni, characters/places/worldNotes/maps viennent de la saga, pas du livre |
| Données vides | Retourne 0 pour tous les champs si les arrays sont absents |

#### `recordIfNeeded` (5 tests)

| Test | Description |
|------|-------------|
| Historique vide | Crée un premier snapshot |
| Dedup interval | Ne crée pas de snapshot si le dernier date de < 15 minutes |
| Après intervalle | Crée un snapshot si le dernier date de > 15 minutes |
| Saga data incluse | Le snapshot contient `sagaData` si fourni |
| Cap à 20 | L'historique ne dépasse jamais `MAX_VERSIONS` (20) |

#### `restore` (6 tests)

| Test | Description |
|------|-------------|
| Données correctes | Restaure les bonnes données (titre, contenu, updatedAt mis à jour) |
| Point de restauration | L'état actuel est sauvegardé avec `isRestore: true` avant restauration |
| Référence pré-shift | Utilise la référence de l'entrée AVANT le `unshift` (fix critique : évite un décalage d'index) |
| Saga data | Le point de restauration inclut la saga courante ; les données restaurées incluent l'ancienne saga |
| Cap à 20 | Même après ajout du restore point, l'historique reste ≤ 20 |
| Index invalide | Throw "Version introuvable" pour index < 0 ou ≥ length |

**Fix critique testé** : dans la restauration, il faut capturer `history[index]` AVANT de faire `history.unshift(...)`, sinon l'index pointe sur la mauvaise entrée après le décalage.

---

### `dailySnapshot.test.ts` — Optimisation des snapshots journaliers

Teste l'optimisation de `updateDailySnapshot` dans `useBookStore.ts` : évite de créer un nouveau tableau (et donc un re-render Zustand) quand rien n'a changé.

| Test | Description |
|------|-------------|
| Même référence | Si toutes les valeurs sont identiques → retourne l'array original (pas de re-render) |
| Nouvelle référence | Si `totalWritten` change → nouveau tableau |
| Nouveau jour | Si aucun snapshot pour aujourd'hui → append |
| Préservation writingMinutes | Le champ `writingMinutesToday` du snapshot existant est préservé lors de la mise à jour |

**Logique testée** : la comparaison champ par champ (`totalWritten`, `writtenToday`, `dailyGoal`, `progress`, `completedScenes`, `totalScenes`, `writingMinutesToday`) permet de retourner la même référence quand rien n'a changé, évitant les re-renders inutiles du Zustand `subscribeWithSelector`.

---

### `calculations.test.ts` — Calculs de progression et objectifs

Teste les fonctions pures de `src/lib/calculations.ts` utilisées pour la progression du livre et les objectifs d'écriture.

| Groupe | Tests | Description |
|--------|-------|-------------|
| `isSceneComplete` | 4 | Vérifie les statuts revision/complete → true, draft/outline → false |
| `isDateExcluded` | 5 | Date dans/hors période, bornes exactes, aucune période |
| `countExcludedDays` | 6 | Aucune période, période chevauchante, multiples, hors range, fromDate ≥ toDate |
| `getSceneTarget` | 5 | Mode total (distribution remaining), perScene, none → null, scène complète |
| `getSceneProgress` | 5 | Modes total/perScene/none, scène complète → 1, cap à 1 |
| `getOverallProgress` | 5 | Modes total/perScene/none, array vide, cap à 1 |
| `getCompletedScenesCount` | 1 | Comptage correct revision+complete vs draft+outline |
| `getDailyGoal` | 7 | Objectif désactivé, type temps, jour exclu, calcul auto, fallback manuel, deadline passée |
| `getPageEstimate` | 3 | Mots → pages, signes → pages (ratio 6), défaut mots |
| `getBookType` | 9 | Chaque seuil (micro-nouvelle → très long roman), unité signes, pages incluses |
| `estimateFromScenes` | 3 | Scènes complètes, fallback contenu, aucun contenu → 0 |

**Note** : `getDailyGoal` utilise `vi.useFakeTimers()` + `vi.setSystemTime()` pour fixer la date du jour.

---

### `utils.test.ts` — Fonctions utilitaires

Teste les fonctions pures de `src/lib/utils.ts`.

| Groupe | Tests | Description |
|--------|-------|-------------|
| `cn` | 3 | Jointure classes, filtrage falsy, tout falsy → '' |
| `convertToSimpleDuration` | 7 | ≤24h → heures, >24h → jours, >60j → mois, >18mois → années, pas d'end date → 1h, startTime extraction, minimum 1h |
| `computeEventEndDate` | 5 | +heures, +jours, +mois (fin de mois), +années, année bissextile |
| `countCharacters` | 4 | Plain text, HTML stripping, &nbsp;, chaîne vide |
| `countWordsFromHtml` | 5 | Plain text, HTML, `<br>`, vide, espaces multiples |
| `convertCount` | 4 | words→chars (×6), chars→words (÷6), même unité, arrondi |
| `countFromHtml` | 2 | Mode mots, mode signes |
| `formatCount` | 2 | Label mots, label signes |
| `countUnitLabel` | 2 | mots, signes |
| `isSpecialChapter` | 4 | front_matter, back_matter, chapter, undefined |
| `getChapterLabel` | 4 | Front/back matter, numéroté sans/avec titre |
| `getChapterShortLabel` | 3 | Front matter, forme courte, avec titre |
| `formatDuration` | 7 | Singulier/pluriel pour heures, jours, mois (invariable), années |
| `formatWritingTime` | 5 | <60min, heures exactes, heures+min, padding minutes, 0 |

---

### `encyclopediaHelpers.test.ts` — CRUD encyclopédie

Teste les fonctions pures de `src/store/encyclopedia-helpers.ts`, partagées entre `useBookStore` et `useSagaStore`.

| Groupe | Tests | Description |
|--------|-------|-------------|
| `createCharacter` | 3 | Defaults, immutabilité, IDs uniques |
| `updateCharacter` | 3 | Mise à jour ciblée, autres personnages intacts, updatedAt |
| `deleteCharacter` | 2 | Suppression correcte, ID inexistant |
| `reorderCharacters` | 1 | Réordonnancement + champ order |
| `addRelationship` | 2 | Ajout avec ID auto, autres personnages intacts |
| `updateRelationship` | 1 | Mise à jour ciblée d'une relation |
| `deleteRelationship` | 1 | Suppression d'une relation |
| `addKeyEvent` | 1 | Ajout événement clé avec ID auto |
| `deleteKeyEvent` | 1 | Suppression événement clé |
| `createPlace` | 1 | Defaults (type 'other', inGlossary false) |
| `updatePlace` | 1 | Mise à jour ciblée |
| `deletePlace` | 1 | Suppression |
| `createTag` | 1 | Default color #6b7280 |
| `updateTag` | 1 | Mise à jour nom + couleur |
| `deleteTag` | 1 | Suppression |
| `createWorldNote` | 1 | Defaults (category 'custom') |
| `updateWorldNote` | 1 | Mise à jour titre + catégorie |
| `deleteWorldNote` | 1 | Suppression |
| `createMap` | 1 | Pins vides par défaut |
| `updateMap` | 1 | Mise à jour nom |
| `deleteMap` | 1 | Suppression |
| `addMapPin` | 2 | Ajout pin, autres maps intactes |
| `updateMapPin` | 1 | Mise à jour ciblée d'un pin |
| `deleteMapPin` | 1 | Suppression d'un pin |

---

### `exportShared.test.ts` — Sanitization export XHTML

Teste les fonctions pures de `src/lib/export-shared.ts` pour la génération d'exports EPUB/PDF valides.

| Groupe | Tests | Description |
|--------|-------|-------------|
| `escapeXml` | 8 | &, <, >, ", ', combinaison, vide, texte safe |
| `cleanHtml` | 14 | Vide → `<p></p>`, self-closing (br, hr, img), suppression classes/data-*, spans vides, entités HTML (nbsp, mdash, ndash, laquo, raquo, hellip), normalisation text-align, transformations combinées |

---

### `upload.test.ts` — Helpers upload images

Teste les fonctions de détection de `src/lib/upload.ts`.

| Groupe | Tests | Description |
|--------|-------|-------------|
| `isBase64` | 4 | data: URL → true, https → false, random → false, vide → false |
| `isUrl` | 5 | https → true, http → true, data: → false, random → false, vide → false |

---

## Ajouter un nouveau test

1. Créer `src/__tests__/monTest.test.ts`
2. Importer depuis `vitest` : `import { describe, it, expect, vi, beforeEach } from 'vitest'`
3. Répliquer la logique à tester (ou l'exporter si approprié)
4. Lancer : `npm test`
5. Mettre à jour ce fichier avec la description des tests ajoutés

## Bonnes pratiques

- **Pas de dépendances externes** : les tests ne dépendent ni de localStorage, ni de stores Zustand, ni d'API
- **Logique pure** : tester des fonctions pures (entrées → sorties), pas des effets de bord
- **Fake timers** : utiliser `vi.useFakeTimers()` pour les tests impliquant des délais, mais attention aux `Promise.reject` asynchrones qui peuvent causer des "unhandled rejection" — dans ce cas, utiliser `vi.useRealTimers()`
- **Nommage** : le fichier de test porte le nom de la fonction/module testé
