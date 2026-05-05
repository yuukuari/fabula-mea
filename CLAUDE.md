# CLAUDE.md — Fabula Mea

## Vue d'ensemble

**Fabula Mea** est une application web d'aide à l'écriture de livres (SPA React + Vercel serverless + Upstash Redis). Elle permet de structurer un roman : personnages, lieux, chapitres, scènes, worldbuilding, cartes, timeline, objectifs, export EPUB/PDF/DOCX. Supporte les **sagas** (encyclopédie partagée entre livres), un système de relecture par relecteurs externes, des tickets/releases, et un panneau admin.

En dev local, tout fonctionne en **localStorage** sans backend. En prod, les données sont dans Redis et les images sur Vercel Blob (CDN).

## Commandes

```bash
npm run dev      # Serveur Vite, port 5174 (tout en localStorage)
npm run build    # Build TypeScript + Vite pour production
npm test         # Tests unitaires Vitest
npm run test:watch
```

## Architecture bi-modale

`src/lib/api.ts` est la **façade unique**. Chaque méthode utilise `IS_DEV ? devDb.xxx() : apiFetch(...)`.

- **Dev** : `dev-auth.ts` (tokens `dev-` + base64) + `dev-db.ts` (localStorage préfixe `emlb-dev:`). Emails simulés en console.
- **Prod** : JWT + bcrypt (`api/_lib/auth.ts`), Redis (`api/_lib/redis.ts`), Resend (`api/_lib/email.ts`), Vercel Blob (`api/upload.ts`)

## Stack technique

React 18 · TypeScript 5.6 · Vite 5.4 · Tailwind 3.4 · Zustand 5 · React Router 6 · TipTap 3.21 · lucide-react · date-fns 4 · @dnd-kit · JSZip + file-saver + docx · nspell · Vitest

## Comment ajouter une fonctionnalité

1. **Types** → `src/types/index.ts`
2. **Mock dev** → `src/lib/dev-db.ts` (CRUD localStorage, préfixe `emlb-dev:`)
3. **Façade API** → `src/lib/api.ts` (ternaire `IS_DEV`)
4. **Serverless** → `api/` (voir `api/CLAUDE.md` : auth, cors, redis, catch-all routes)
5. **Store Zustand** → `src/store/` (pattern: `create<MyStore>((set, get) => ...)`)
6. **Pages/composants** → `src/pages/`, `src/components/{domaine}/`
7. **Route** → `src/App.tsx` : `AppShell` (pages livre), `HomeShell` (pages hors-livre), ou route directe sous `RootLayout` (plein écran)

## Conventions de code

- **Tailwind CSS** exclusivement. Palette : `parchment`, `ink`, `bordeaux`, `gold`. Polices : `font-serif` (Crimson Text), `font-display` (Playfair Display), `font-sans` (Inter)
- **Icônes** : `lucide-react` uniquement
- **Composants** : fonctionnels React, TypeScript strict, pas de `any`. Pattern : `interface Props { ... }` puis `export function Component({ ... }: Props)`
- **Imports** : alias `@/` = `src/` (ex: `import { api } from '@/lib/api'`)
- **IDs** : `generateId()` = `crypto.randomUUID()`. Timestamps : `now()` = `new Date().toISOString()`
- **Stores** : pages importent via hooks Zustand `const x = useMyStore((s) => s.x)`

## Modèle de données (résumé)

Un **BookProject** contient : Characters (avec genealogy, relations, avatar imageOffsetY, order), Places (order), Chapters (front_matter/chapter/back_matter), Scenes (statut outline→draft→revision→complete), TimelineEvents, Tags, WorldNotes, NoteIdeas, Maps, ProjectGoals, DailySnapshots, Layout (BookLayout avec PrintEdition + DigitalEdition + CoverMode), CountUnit, GlossaryEnabled, TableOfContents, CustomDictionary.

**Sagas** : `SagaMeta` + `SagaProject` (personnages/lieux/univers/cartes partagés). `useEncyclopediaStore` route vers `useSagaStore` ou `useBookStore`. N'a PAS de layout (toujours au niveau du livre).

**WritingMode** : `count` (saisie manuelle) ou `write` (éditeur TipTap, comptage auto).

## Points d'attention essentiels

1. **Toujours modifier les deux côtés** : `dev-db.ts` ET le endpoint `api/` correspondant
2. **Façade `api.ts`** : ternaire `IS_DEV` pour chaque nouvelle méthode
3. **Clés Redis** en prod : préfixe `emlb:` (PAS `emlb-dev:`)
4. **Serverless functions** : CommonJS, catch-all routes `[[...path]].ts` (limite 12 fonctions Vercel Hobby, 12 actuellement — limite atteinte, regrouper en catch-all avant d'en ajouter)
5. **CORS** : appeler `handleCors(req, res)` en premier dans chaque endpoint
6. **Auth** : `requireAuth(req, res)` retourne `{ userId }` ou `null`
7. **`useBookStore`** (~1450 lignes) : le plus complexe. Auto-save local + cloud. Interagit avec `useSagaStore`
8. **TipTap** : éditeur de scènes, tickets, notes & idées. Extensions `text-style`, `font-family`, `font-size-extension.ts` (custom). h1/h2/h3 retirés de la toolbar. Collage nettoyé via `transformPastedHTML`. **Typographie française** dans le SceneEditor uniquement (`french-typography-extension.ts`) : NBSP inséré à la saisie avant `: ; ! ? » %` et après `«` ; `--` → `–` (semi-cadratin), `---` → `—` (cadratin). Les NBSP sont stockés en U+00A0 dans le HTML et préservés par les compteurs et exports.
9. **Page relecteur** (`/review/:token`) : publique, sans auth
10. **Images CDN** : Vercel Blob en prod, base64 en dev. Migration lazy dans `saveBook()`. `src/lib/upload.ts`
11. **Mettre à jour la documentation** après toute modification structurelle (nouvelle fonctionnalité, refactor, nouveau type, nouvel endpoint, changement d'architecture). Selon ce qui a été touché :
    - **Architecture générale, conventions, points d'attention universels** → ce fichier (`CLAUDE.md`)
    - **Module spécifique** (édition, relecture, notifications, timeline, spellcheck, spotify, sync) → le fichier correspondant dans `.claude/rules/`
    - **Endpoint API, clés Redis, patterns serverless** → `api/CLAUDE.md`
    - **Nouveau test ou refactor de tests** → `src/__tests__/CLAUDE.md`
    - **Si le module n'a pas encore de rule dédiée** mais devient complexe (>30 lignes de doc), créer un nouveau fichier dans `.claude/rules/` avec frontmatter `paths:` scopé aux fichiers concernés, puis l'ajouter dans la liste « Fonctionnalités avec documentation détaillée » de ce CLAUDE.md
    - **Garder les fichiers sous 200 lignes** ; si un fichier déborde, c'est le signal qu'il faut splitter
12. **Review du code** : après chaque implémentation, vérifier doublons, cleanups d'effets, race conditions, cohérence patterns

## Fonctionnalités avec documentation détaillée

Les modules complexes ont leur documentation dans `.claude/rules/` (chargée automatiquement quand tu travailles sur les fichiers concernés) :

- **Module Édition** (couvertures, export, conformité, BookReader) → `.claude/rules/edition.md`
- **Relecture** (sessions, commentaires, highlights) → `.claude/rules/reviews.md`
- **Notifications** (in-app, push, polling) → `.claude/rules/notifications.md`
- **Correcteur orthographique** (nspell, LanguageTool, menu contextuel) → `.claude/rules/spellcheck.md`
- **Aide à l'écriture** (panneau Wand2 dans SceneEditor : répétitions, synonymes, antonymes, figures de style, rapport d'analyse avec scores ; surbrillance + navigation hit-par-hit via extension TipTap) → `.claude/rules/writing-aid.md`
- **IA** (façade `src/lib/ai`, providers serveur, mesure d'usage Redis fenêtre glissante 7j, limites par feature/utilisateur, génération d'image personnage via fal.ai) → `.claude/rules/ai.md`
- **Spotify** (OAuth PKCE, Web Playback SDK) → `.claude/rules/spotify.md`
- **Chronologie** (timeline events, filtrage doux, dates < 1000) → `.claude/rules/timeline.md`
- **Sync & persistance** (cloudSaveWithRetry, guards, historique versions) → `.claude/rules/sync-persistence.md`

## Autres points de référence

- **Tickets** : globaux, types `bug`/`question`/`improvement`, visibilité `public`/`private`, statuts `open`/`closed_done`/`closed_duplicate`. TicketBubble uniquement sur HomePage.
- **Releases** : statuts `draft` → `planned` → `current` → `released`. Auto-demotion.
- **Drag-and-drop** : personnages, lieux, worldNotes, noteIdeas, scènes (intra/inter-chapitre). Désactivé quand filtre/recherche actif. `@dnd-kit`.
- **Graphe relations** : edges normalisés par tri d'ID. Types always-reciprocal (`friend`/`enemy`/`colleague`/`family`) vs optionnellement réciproques. `arrowTarget` pour les flèches.
- **Arbre généalogique** : `CharacterGenealogy` (parents, conjoints ordonnables, enfants groupés par conjoint). Rôles typés + custom. Composants dans `src/components/genealogy/`.
- **Timer écriture** : 3 modes (libre, minuteur, pomodoro). `FloatingWritingTimer` + `useWritingTimer`. Document PiP. Alarmes Web Audio.
- **Glossaire** : `glossaryEnabled` + `inGlossary` par entité. Affiché dans manuscrit, éditeur, relectures, exports. Toggle direct depuis fiche personnage/lieu/univers via `<GlossaryBadge>` (composant partagé `src/components/encyclopedia/`).
- **Mode lecture (BookReader)** : globalisé via `useReaderStore` (Zustand), monté dans `AppShell`. Pilule « Mode lecture » dans `EditorTabs` à côté de « Mode écriture » (mutuellement exclusifs).
- **Table des matières** : `tableOfContents` dans BookProject. PDF/EPUB/DOCX. CSS `target-counter()` pour les numéros de page.
- **Profil** : `/profile` dans HomeShell. Avatar avec recadrage rond.
- **Sidebar livre** : Vue d'ensemble → Encyclopédie → Manuscrit (Chronologie en 1er) → Suivi → **Édition** (groupe top-level) → Notes & Idées → Paramètres → Aide & Support.
- **Redirection post-login** : URL sauvegardée dans `sessionStorage` (`emlb-redirect-after-login`)

## Déploiement

Vercel : `vercel.json` (buildCommand, outputDirectory, SPA rewrite). Serverless functions auto-déployées. `api/package.json` avec `"type": "commonjs"`.
