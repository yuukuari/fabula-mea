---
paths:
  - "src/pages/TimelinePage.tsx"
  - "src/components/timeline/**"
---

# Chronologie (Timeline)

## TimelineEvents

Événements chronologiques indépendants des scènes. Stockés dans `BookProject.timelineEvents[]`.

Chaque événement : `startDate` (YYYY-MM-DD), `startTime?` (HH:mm), durée (`EventDuration` : valeur + unité heures/jours/mois/années), `order`, personnages, lieu, `chapterId?`, `sceneId?`.

Si une scène est liée, elle partage les mêmes dates/durées (modifier l'un modifie l'autre).

## Opérations

- Insertion avant/après un autre événement
- Découpe en N parties (`SplitDialog`)
- Conversion en chapitre + scène
- Rattachement à tout type de chapitre (front_matter, classique, back_matter)
- Badge cliquable dans `ChaptersPage` → modale `EventsListDialog`

## Filtrage doux

Les filtres ne masquent plus les événements non correspondants → affichés avec `opacity-20`. L'axe temporel et les rangées restent stables.

## Rangées

Triées par `order` des personnages (drag-and-drop dans CharactersPage). Vue par personnage OU par lieu, filtres croisés.

## Dates < 1000

Les années < 1000 sont supportées (ex: 0157). Lors de la conversion `Date → string YYYY-MM-DD`, toujours utiliser `String(d.getFullYear()).padStart(4, '0')`. Endroits concernés : `insertTimelineEvent`, `splitTimelineEvent` dans `useBookStore.ts`, et `handleMouseUp` dans `TimelinePage.tsx`.

## Migration

Migration automatique depuis les anciens champs `startDateTime`/`endDateTime` des scènes (arrondis : ≤24h→heures, >24h→jours, >60j→mois, >18mois→années).
