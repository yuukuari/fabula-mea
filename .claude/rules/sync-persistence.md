---
paths:
  - "src/store/useBookStore.ts"
  - "src/store/useLibraryStore.ts"
  - "src/store/useSyncStore.ts"
  - "src/lib/calculations.ts"
---

# Synchronisation & persistance

## Source de vérité

Le serveur est la **source de vérité**. Le localStorage sert de **cache** pour un affichage instantané.

```
saveBook() → localStorage.setItem(key, json)   ← toujours (cache)
           → cloudSaveWithRetry(api.books.save) ← obligatoire si token JWT
```

## cloudSaveWithRetry

3 tentatives, backoff exponentiel (1s, 2s, 4s). Échec → `useSyncStore.setError()` (visible sidebar).

## Debounce auto-save

Subscriber Zustand sur `updatedAt` → `saveBook()` après 500ms. `cancelPendingSave()` dans `loadBook` et `unloadBook` (évite sauvegardes cross-book).

## Guards anti-stale

- **`bookIdAtSave`** — capture l'id à l'appel, vérifie au resolve de la promesse
- **`loadedAt`** — capture `updatedAt` au chargement, refuse les données cloud si l'utilisateur a édité entre-temps
- **`getTodayProgress`** — refuse de créer un snapshot quand `currentTotal === 0` (données pas encore chargées). Répare les snapshots empoisonnés. Sans ce guard : race condition `loadBook(scenes=[])` → snapshot `{total:0}` → tout le contenu affiché comme "écrit aujourd'hui"

## Chargement d'un livre (`loadBook`)

1. Charge depuis localStorage (cache immédiat). Si pas de cache → état minimal `{ id: bookId }`
2. Fetch serveur en parallèle
3. Applique données cloud sauf si édité (guard `loadedAt`)

## Historique des versions

Snapshots auto toutes les **15 min** (dedup), max **20 versions**. Redis LIST (prod) / localStorage array (dev).
- Stats : chapitres, scènes, événements, mots, personnages, lieux, worldNotes, maps, notes
- Saga data incluse si livre appartient à une saga
- Restauration : sauvegarde point de restauration (`isRestore: true`) avant de restaurer, puis `window.location.reload()`

## DailySnapshots

Historique quotidien (date, totalWritten, writtenToday, dailyGoal, progress, scenes counts, writingMinutesToday). Mis à jour à chaque `saveBook()`. Optimisation : comparaison champ par champ pour éviter les re-renders Zustand inutiles (même référence si rien n'a changé).

## Clés localStorage client

- `fabula-mea-library` — Bibliothèque (persist Zustand)
- `fabula-mea-book-{bookId}` — Données livre
- `fabula-mea-saga-{sagaId}` — Données saga
- `emlb-token` — Token JWT/dev
- `emlb-daily-snapshot:{bookId}` — Snapshot début de journée
- `fabula-mea-writing-timer` — État timer d'écriture
