# CLAUDE.md — Tests unitaires

## Configuration

- **Vitest 1.x** en environnement `node` (pas de `jsdom` — logique pure)
- Config : section `test` dans `vite.config.ts`
- Setup : `src/__tests__/setup.ts` — polyfill `crypto` pour Node 18
- Commandes : `npm test` (run), `npm run test:watch` (watch)

## Convention

Les tests répliquent la logique des fonctions internes (non exportées) pour les tester en isolation. Si une fonction est refactorée, le test doit être mis à jour.

## Fichiers de test (~209 tests)

| Fichier | Module testé | Couverture |
|---------|-------------|------------|
| `cloudSaveWithRetry.test.ts` | Pattern retry backoff | Succès, retry, échec total, délais exponentiels |
| `versionHistory.test.ts` | Snapshots & restauration | extractStats, dedup 15min, restore (saga data, cap 20, fix index pre-shift) |
| `dailySnapshot.test.ts` | Optimisation re-render | Même référence si rien ne change, préservation writingMinutes |
| `calculations.test.ts` | `calculations.ts` | isSceneComplete, isDateExcluded, countExcludedDays, getSceneTarget/Progress, getOverallProgress, getDailyGoal, getPageEstimate, getBookType, estimateFromScenes, **getTodayProgress** (guard race condition cloud) |
| `utils.test.ts` | `utils.ts` | cn, convertToSimpleDuration, computeEventEndDate, countCharacters/Words, convertCount, formatCount, isSpecialChapter, getChapterLabel, formatDuration/WritingTime |
| `encyclopediaHelpers.test.ts` | `encyclopedia-helpers.ts` | CRUD complet (characters, places, tags, worldNotes, maps, pins), relations réciproques, keyEvents |
| `exportShared.test.ts` | `export-shared.ts` | escapeXml (8 cas), cleanHtml (14 cas : self-closing, classes, entités, text-align) |
| `upload.test.ts` | `upload.ts` | isBase64, isUrl |

## Ajouter un test

1. Créer `src/__tests__/monTest.test.ts`
2. `import { describe, it, expect, vi, beforeEach } from 'vitest'`
3. Répliquer la logique ou l'importer
4. `npm test`
5. Mettre à jour ce fichier

## Bonnes pratiques

- **Pas de dépendances externes** (localStorage, stores, API)
- **Logique pure** (entrées → sorties)
- **Fake timers** : `vi.useFakeTimers()` pour les délais, mais `vi.useRealTimers()` si `Promise.reject` asynchrone (évite unhandled rejection)
- **Nommage** : fichier = module testé
