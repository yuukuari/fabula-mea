# CLAUDE.md — Fabula Mea

## Vue d'ensemble

**Fabula Mea** est une application web d'aide à l'écriture de livres. Elle permet de structurer un projet de roman : personnages, lieux, chapitres, scènes, worldbuilding, cartes, timeline, objectifs de progression, export EPUB/PDF/DOCX. L'application supporte les **sagas** (regroupement de plusieurs livres partageant une encyclopédie commune). Elle inclut aussi un système de tickets (bug/amélioration/question), de releases, et un panneau d'administration.

L'application est une **SPA React** déployée sur **Vercel**, avec des serverless functions pour l'API et **Upstash Redis** pour la persistance en production. En développement local, tout fonctionne en **localStorage** sans aucun backend.

L'application inclut aussi un **système de relecture** permettant à un auteur de partager des chapitres/scènes avec des relecteurs externes (non-inscrits). Les relecteurs accèdent via un lien unique à une page publique (sans authentification) et peuvent commenter le texte en sélectionnant des passages.

Un **système d'emails** (via Resend) notifie les utilisateurs à différentes étapes : invitation de relecture, envoi de commentaires (relecteur → auteur, auteur → relecteur), complétion de relecture, et création de tickets. En développement local, les emails ne sont pas envoyés mais **simulés dans la console** (`📧 [DEV EMAIL]`).

---

## Architecture bi-modale : Dev vs Production

### Le principe central

Le fichier `src/lib/api.ts` est la **façade unique** pour toutes les opérations de données. Il utilise un ternaire `IS_DEV` pour rediriger chaque appel :

```typescript
const IS_DEV = import.meta.env.DEV; // true en `npm run dev`, false en `npm run build`

// Exemple :
login: (data) => IS_DEV ? devAuth.login(data) : apiFetch('/auth/login', { method: 'POST', body: ... })
```

### Mode développement (`npm run dev`)

- **Authentification** → `src/lib/dev-auth.ts` : stocke les utilisateurs dans `localStorage` (`emlb-dev-users`, `emlb-dev-emails`). Les tokens sont des chaînes `dev-` + base64 (pas de vrai JWT).
- **Base de données** → `src/lib/dev-db.ts` : toutes les données (livres, tickets, releases, commentaires) sont dans `localStorage` avec le préfixe `emlb-dev:`.
- **Aucun serveur nécessaire** : juste `npm run dev` suffit.
- **Aucune variable d'environnement nécessaire**.
- **Emails simulés** : un helper `devEmailLog` dans `dev-db.ts` affiche dans la console les détails de chaque email qui serait envoyé en production (destinataire, sujet, contenu).

### Mode production (Vercel)

- **Authentification** → `api/auth/*.ts` : vrais JWT signés avec `JWT_SECRET`, hashage bcrypt.
- **Base de données** → Upstash Redis via `api/_lib/redis.ts` (REST API).
- **Images** → Vercel Blob via `api/upload.ts` : les images sont uploadées sur un CDN (Vercel Blob Storage) et stockées sous forme d'URLs publiques. En dev, les images restent en base64 dans localStorage.
- **Variables d'environnement requises** (configurées dans Vercel) :
  - `JWT_SECRET` — Secret pour signer les tokens JWT
  - `UPSTASH_REDIS_REST_URL` — URL de l'instance Upstash Redis
  - `UPSTASH_REDIS_REST_TOKEN` — Token d'accès Upstash Redis
  - `RESEND_API_KEY` — Clé API Resend pour l'envoi d'emails
  - `BLOB_READ_WRITE_TOKEN` — Token Vercel Blob pour l'upload d'images
  - `TURNSTILE_SECRET_KEY` — (optionnel) Clé secrète Cloudflare Turnstile pour le CAPTCHA à l'inscription
  - `VITE_VAPID_PUBLIC_KEY` — (optionnel) Clé publique VAPID pour Web Push (aussi dans `.env` en local). Générée via `npx web-push generate-vapid-keys`
  - `VAPID_PRIVATE_KEY` — (optionnel) Clé privée VAPID pour Web Push (serveur uniquement). Nécessaire en prod pour envoyer les notifications push
  - `VITE_SPOTIFY_CLIENT_ID` — (optionnel) Client ID de l'app Spotify (aussi dans `.env` en local). Active le lecteur Spotify intégré. Pas besoin de client secret (PKCE)

### Clés localStorage (dev) vs Redis (prod)

| Donnée | localStorage (dev) | Redis (prod) |
|--------|-------------------|--------------|
| Bibliothèque | `emlb-dev:u:{userId}:library` | `emlb:u:{userId}:library` |
| Livre | `emlb-dev:u:{userId}:book:{bookId}` | `emlb:u:{userId}:book:{bookId}` |
| Tickets | `emlb-dev:tickets` | `emlb:tickets` |
| Commentaires ticket | `emlb-dev:ticket:{id}:comments` | `emlb:ticket:{id}:comments` |
| Status changes ticket | `emlb-dev:ticket:{id}:statusChanges` | `emlb:ticket:{id}:statusChanges` |
| Releases | `emlb-dev:releases` | `emlb:releases` |
| Sessions relecture (par id) | `emlb-dev:review:{id}` | `emlb:review:{id}` |
| Sessions relecture (par token) | `emlb-dev:review:token:{token}` | `emlb:review:token:{token}` |
| Index sessions (par auteur) | `emlb-dev:u:{userId}:reviews` | `emlb:u:{userId}:reviews` |
| Commentaires relecture | `emlb-dev:review:{id}:comments` | `emlb:review:{id}:comments` |
| Utilisateurs | `emlb-dev-users` / `emlb-dev-emails` | `emlb:user:{id}` / `emlb:email:{email}` |
| Index membres | — | `emlb:member-ids` |
| Saga (métadonnées) | `emlb-dev:saga:{sagaId}:meta` | `emlb:saga:{sagaId}:meta` |
| Saga (données partagées) | `emlb-dev:saga:{sagaId}` | `emlb:saga:{sagaId}` |
| Notifications | `emlb-dev:notifications` | `emlb:notifications` |
| Notification reads (par user) | `emlb-dev:u:{userId}:notification-reads` | `emlb:u:{userId}:notification-reads` |
| Push subscription (par user) | `emlb-dev:u:{userId}:push-subscription` | `emlb:u:{userId}:push-subscription` |

---

## Comment ajouter une nouvelle fonctionnalité (checklist)

### 1. Types (`src/types/index.ts`)
Ajouter les interfaces/types nécessaires.

### 2. Mock dev (`src/lib/dev-db.ts`)
Ajouter les méthodes CRUD dans `devDb` avec stockage `localStorage` (préfixe `emlb-dev:`).

### 3. API facade (`src/lib/api.ts`)
Ajouter les méthodes avec le ternaire `IS_DEV ? devDb.xxx() : apiFetch(...)`.

### 4. Serverless functions (`api/`)
Créer les fichiers dans `api/` pour la version production. Chaque endpoint :
- Importe `requireAuth` depuis `api/_lib/auth.ts` pour l'authentification
- Importe `corsHeaders`, `handleCors` depuis `api/_lib/cors.ts`
- Importe `redis` depuis `api/_lib/redis.ts` pour la persistance
- Gère les méthodes HTTP (`GET`, `POST`, `PATCH`, `DELETE`) dans un switch
- Retourne des réponses JSON avec les bons headers CORS
- Voir `api/CLAUDE.md` pour la structure détaillée

### 5. Store Zustand (`src/store/`)
Créer ou étendre un store. Pattern standard :
```typescript
import { create } from 'zustand';
import { api } from '@/lib/api';

interface MyStore {
  items: Item[];
  loading: boolean;
  fetchItems: () => Promise<void>;
  // ...
}

export const useMyStore = create<MyStore>((set, get) => ({
  items: [],
  loading: false,
  fetchItems: async () => {
    set({ loading: true });
    const items = await api.myFeature.list();
    set({ items, loading: false });
  },
}));
```

### 6. Pages et composants (`src/pages/`, `src/components/`)
- Les pages vont dans `src/pages/`
- Les composants réutilisables dans `src/components/{domaine}/`
- Ajouter la route dans `src/App.tsx`

### 7. Route (`src/App.tsx`)
Choisir le layout adapté :
- `AppShell` — Pages liées à un livre (sidebar avec navigation livre)
- `HomeShell` — Pages indépendantes du livre (accueil, tickets, releases, admin, profil, sagas)
- Route directe sous `RootLayout` — Pages plein écran (ex: `ForgotPasswordPage`, `ReviewReaderPage`, `ReviewAuthorView`)

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | React | 18.3 |
| Langage | TypeScript | 5.6 |
| Build | Vite | 5.4 |
| CSS | Tailwind CSS | 3.4 |
| State | Zustand | 5.x |
| Routing | React Router | 6.x |
| Éditeur texte | TipTap | 3.21 |
| Icônes | lucide-react | 0.462 |
| Dates | date-fns | 4.1 |
| Drag & Drop | @dnd-kit | 6.x / 10.x |
| Export | JSZip + file-saver + docx | — |
| Hébergement | Vercel (SPA + serverless) | — |
| Base de données | Upstash Redis (prod) / localStorage (dev) | — |
| Stockage images | Vercel Blob (prod) / base64 localStorage (dev) | — |
| Tests | Vitest | 1.x |

---

## Structure des fichiers

```
/
├── CLAUDE.md                    ← Ce fichier
├── package.json                 ← Scripts: dev, build, preview, test
├── vite.config.ts               ← Port 5174, alias @ → ./src, config Vitest
├── tailwind.config.js           ← Couleurs custom (parchment, ink, bordeaux, gold)
├── vercel.json                  ← SPA rewrite, buildCommand, outputDirectory
├── tsconfig.json
│
├── api/                         ← Serverless functions (Vercel) — CommonJS, catch-all routes
│   ├── CLAUDE.md                ← Doc spécifique API
│   ├── package.json             ← { "type": "commonjs" }
│   ├── _lib/                    ← Utilitaires partagés (auth, cors, redis, email, utils, notifications)
│   ├── auth/[[...path]].ts      ← signup, login, me, profile, change-password, account, forgot-password, reset-password (catch-all)
│   ├── book/[bookId].ts         ← CRUD livre par utilisateur
│   ├── saga/[sagaId].ts         ← CRUD saga (métadonnées + données partagées)
│   ├── tickets/[[...path]].ts   ← CRUD tickets + commentaires + réactions (catch-all)
│   ├── releases/[[...path]].ts  ← CRUD releases (catch-all)
│   ├── admin/members.ts         ← Endpoints admin (membres)
│   ├── notifications/[[...path]].ts ← CRUD notifications (list, markRead, markAllRead, markByPayload, push)
│   ├── reviews/[[...path]].ts   ← Auteur + relecteur (reader/) dans un seul catch-all
│   ├── library.ts               ← GET/POST bibliothèque utilisateur
│   ├── upload.ts                ← Upload d'images vers Vercel Blob (CDN)
│   └── migrate.ts               ← Migration de données
│
├── src/
│   ├── App.tsx                  ← Router + layouts (RootLayout → shells)
│   ├── main.tsx                 ← Point d'entrée React
│   ├── index.css                ← Tailwind directives + styles globaux
│   │
│   ├── __tests__/               ← Tests unitaires Vitest (voir __tests__/CLAUDE.md)
│   │
│   ├── types/
│   │   └── index.ts             ← Tous les types TypeScript (~523 lignes)
│   │
│   ├── lib/
│   │   ├── api.ts               ← ⭐ Façade API (IS_DEV ternaire)
│   │   ├── dev-auth.ts          ← Mock auth localStorage
│   │   ├── dev-db.ts            ← Mock DB localStorage
│   │   ├── redis.ts             ← Client Upstash côté client (sync directe)
│   │   ├── utils.ts             ← Helpers (generateId, now, CHAPTER_COLORS, countCharacters, countWordsFromHtml, formatCount, countUnitLabel, isSpecialChapter, getChapterLabel, getChapterShortLabel, convertToSimpleDuration, computeEventEndDate, formatDuration...)
│   │   ├── calculations.ts      ← Calculs progression (mots/jour, scènes/jour, getTodayProgress, dailySnapshot)
│   │   ├── fonts.ts             ← Config polices (FONT_STACKS, AVAILABLE_FONTS, DEFAULT_LAYOUT)
│   │   ├── upload.ts            ← Helper upload images (CDN en prod, base64 en dev)
│   │   ├── export-shared.ts     ← Types et helpers partagés (cleanHtml, escapeXml) pour les exports
│   │   ├── export-epub.ts       ← Génération EPUB 3
│   │   ├── export-pdf.ts        ← Export PDF via window.print()
│   │   ├── export-docx.ts       ← Export DOCX (Word) via bibliothèque docx
│   │   ├── migration.ts         ← Migrations (single-book → multi-book, clés localStorage, scènes → TimelineEvents)
│   │   ├── spellcheck-extension.ts ← Extension TipTap correcteur
│   │   ├── push.ts              ← Web Push notifications (subscribe, unsubscribe, local notification)
│   │   └── spotify.ts           ← Client Spotify OAuth PKCE + API playlists
│   │
│   ├── hooks/
│   │   ├── useNotificationPolling.ts ← Polling notifications toutes les 60s
│   │   ├── useWritingTimer.ts   ← Hook timer d'écriture (3 modes, suivi temps, persistance localStorage)
│   │   └── useSpotifyPlayer.ts  ← Hook Web Playback SDK (init, play, pause, skip, device discovery)
│   │
│   ├── store/
│   │   ├── useAuthStore.ts      ← Authentification (login/signup/logout/profil)
│   │   ├── useLibraryStore.ts   ← Bibliothèque multi-livres + sagas (persist Zustand)
│   │   ├── useBookStore.ts      ← ⭐ Store principal (~1450 lignes) : tout le contenu du livre
│   │   ├── useSagaStore.ts      ← Données partagées de la saga (personnages, lieux, univers, cartes)
│   │   ├── encyclopedia-helpers.ts ← CRUD partagé personnages/lieux/tags/worldNotes/maps + reorderCharacters (utilisé par useBookStore et useSagaStore)
│   │   ├── useEncyclopediaStore.ts ← Abstraction routant les données encyclopédie (saga vs livre)
│   │   ├── useEditorStore.ts    ← État éditeur de scène (open/close/entrySceneId)
│   │   ├── useSyncStore.ts      ← Statut synchronisation cloud
│   │   ├── useTicketStore.ts    ← CRUD tickets + commentaires + réactions
│   │   ├── useTicketFormStore.ts ← État du formulaire de ticket (open/close)
│   │   ├── useReleaseStore.ts   ← CRUD releases
│   │   ├── useNotificationStore.ts ← Notifications in-app (list, markRead, badges, polling)
│   │   └── useReviewStore.ts    ← CRUD sessions de relecture + commentaires
│   │
│   ├── pages/                   ← Pages de l'application
│   │   ├── HomePage.tsx         ← Accueil / sélection de livre + sagas (badge commentaires en attente)
│   │   ├── SagaPage.tsx         ← Gestion d'une saga (livres, encyclopédie partagée)
│   │   ├── ProfilePage.tsx      ← Profil utilisateur (nom, email, avatar, mot de passe)
│   │   ├── EncyclopediaPage.tsx ← ⭐ Tableau de bord du livre (stats, objectif du jour, temps d'écriture, manuscrit, relectures, encyclopédie)
│   │   ├── CharactersPage.tsx   ← Gestion personnages (drag-and-drop pour réordonner)
│   │   ├── PlacesPage.tsx       ← Gestion lieux
│   │   ├── ChaptersPage.tsx     ← Chapitres + scènes + éditeur + événements associés (badge + modale)
│   │   ├── TimelinePage.tsx     ← Frise chronologique (vue par personnage OU par lieu, filtres croisés, filtrage doux par opacité, rangées triées par order des personnages)
│   │   ├── ProgressionPage.tsx  ← Progression globale (temps total d'écriture, pages estimées avec tooltip livre de poche) + « Longueur du livre » (stats en grille)
│   │   ├── ObjectifsPage.tsx   ← Objectifs d'écriture (mots/temps avec barre de progression) + périodes exclues (modale) + courbe (rythme idéal tenant compte des pauses, estimation, tooltip au survol)
│   │   ├── WorldPage.tsx        ← Notes de worldbuilding
│   │   ├── MapsPage.tsx         ← Cartes interactives
│   │   ├── NotesIdeasPage.tsx   ← Notes & idées (grille de cartes, TipTap avec toolbar complète + checklists)
│   │   ├── EditionPage.tsx      ← Édition / mise en page / export (EPUB, PDF, DOCX)
│   │   ├── SettingsPage.tsx     ← Paramètres + import
│   │   ├── TicketsPage.tsx      ← Tickets/feedback (filtre ouvert par défaut)
│   │   ├── ReleaseNotesPage.tsx ← Notes de version
│   │   ├── ReviewsPage.tsx      ← Liste des sessions de relecture (auteur, filtres par statut)
│   │   ├── AuthPage.tsx         ← Login/Inscription
│   │   ├── ForgotPasswordPage.tsx ← Mot de passe oublié
│   │   ├── ResetPasswordPage.tsx  ← Réinitialisation mot de passe (via token email)
│   │   ├── SpotifyCallbackPage.tsx ← Callback OAuth Spotify (popup, échange PKCE)
│   │   ├── admin/
│   │   │   ├── AdminMembersPage.tsx  ← Gestion des membres (admin) + toggle Spotify par utilisateur
│   │   │   └── AdminReleasesPage.tsx ← Gestion des releases (admin)
│   │   ├── review/
│   │   │   └── ReviewReaderPage.tsx ← Page publique relecteur (sans auth)
│   │   └── reviews/
│   │       └── ReviewAuthorView.tsx ← Vue détaillée relecture (auteur)
│   │
│   └── components/
│       ├── layout/
│       │   ├── AppShell.tsx     ← Layout livre (sidebar + contenu)
│       │   ├── Sidebar.tsx      ← Navigation livre
│       │   ├── HomeShell.tsx    ← Layout pages hors-livre (accueil, tickets, releases, admin, profil, sagas)
│       │   ├── HomeSidebar.tsx  ← Navigation hors-livre
│       │   └── SearchDialog.tsx ← Recherche globale (Cmd+K)
│       ├── editor/              ← Éditeur TipTap (SceneEditor, SceneInlineEditor, EditorTabs, SelfCommentPanel)
│       ├── characters/          ← Fiches personnages, relations, graphe, CharacterAvatar (composant réutilisable avatar rond)
│       ├── notifications/        ← NotificationBell, NotificationModal, PushOptInModal
│       ├── maps/                ← Viewer de cartes, épingles
│       ├── progress/            ← Timer d'écriture (FloatingWritingTimer), lecteur Spotify (FloatingSpotifyPlayer), stats
│       ├── shared/              ← ConfirmDialog, EmptyState, ImageUpload (mode rond avec recadrage), PasswordInput, TagBadge
│       ├── tickets/             ← TicketForm, TicketDetail, ticket-constants
│       ├── timeline/            ← EventEditorDialog, SplitDialog, NewEventDialog, InsertEventDialog, TimelineTooltip, DurationInput, TimelineRow
│       ├── releases/            ← NewReleaseModal, ReleaseVersionFooter
│       └── reviews/             ← NewReviewDialog, ReviewCommentPanel, ReviewContentViewer
```

---

## Modèle de données

### Entités d'un livre (`BookProject`)

Un livre contient :
- **Characters** — Personnages avec relations mutuelles, évolution, événements clés, avatar rond avec `imageOffsetY` (pourcentage 0-100 pour le centrage vertical de l'image), `order?` (position dans la liste, définie par drag-and-drop)
- **Places** — Lieux typés (ville, bâtiment, paysage...) avec connexions
- **Chapters** — Chapitres ordonnés, contenant des scènes. Trois types via `ChapterType` :
  - `front_matter` — Section « Avant l'histoire » (dédicace, prologue, etc.) — number 0, créé automatiquement
  - `chapter` — Chapitre classique numéroté (type par défaut)
  - `back_matter` — Section « Après l'histoire » (épilogue, remerciements, etc.) — number 99999, créé automatiquement
  - Les chapitres front/back matter ne peuvent pas être supprimés ni réordonnés. Ils s'affichent avant/après les chapitres normaux dans l'UI et les exports.
- **Scenes** — Scènes avec statut (outline/draft/revision/complete), personnages, lieu, contenu TipTap
- **TimelineEvents** — Événements chronologiques indépendants des scènes. Chaque événement a une date de début (`startDate` YYYY-MM-DD), une heure optionnelle (`startTime` HH:mm), une durée (`EventDuration` : valeur + unité heures/jours/mois/années), un ordre, des personnages, un lieu, et optionnellement une référence à un chapitre (`chapterId?`) et une seule scène (`sceneId?`). Si une scène est liée, elle partage les mêmes dates/durées que l'événement (modifier l'un modifie l'autre). Les événements sont stockés dans `BookProject.timelineEvents[]`. Migration automatique depuis les anciens champs `startDateTime`/`endDateTime` des scènes (arrondis : ≤24h→heures, >24h→jours, >60j→mois, >18mois→années). Les événements peuvent être insérés avant/après un autre, découpés en N parties, et convertis en chapitre+scène. La création d'un événement (`NewEventDialog`) et l'édition (`EventEditorDialog`) permettent de rattacher un événement à **tout type de chapitre** (front_matter, chapitre classique, back_matter) et d'y créer une scène. Les boutons « + Chapitre » et « + Scène » n'apparaissent que si aucun n'est sélectionné. La page **ChaptersPage** affiche un badge cliquable (icône calendrier + nombre) sur chaque chapitre et scène ayant des événements associés ; le clic ouvre une modale `EventsListDialog` listant les événements avec date, durée, description, personnages et lieu.
- **Tags** — Système d'étiquettes réutilisables
- **WorldNotes** — Notes de worldbuilding catégorisées
- **NoteIdeas** — Notes et idées libres avec éditeur TipTap (toolbar complète : titres, formatage, alignement, listes, checklists, citations, images, liens), affichées en grille de cartes avec aperçu HTML du contenu (titre facultatif, contenu obligatoire), vue détail au clic
- **Maps** — Cartes avec épingles liées aux lieux
- **ProjectGoals** — Objectifs structurés en deux volets : (1) « Longueur du livre » (`GoalMode` : total/perScene/none) définit la cible de mots/signes du livre ; (2) « Je me fixe un objectif d'écriture » (`objectiveEnabled`, `ObjectiveType` : wordCount/time) avec date cible, objectif journalier auto-calculé ou manuel, ou objectif en temps (heures/jour, /semaine, /mois). Périodes exclues déduites des jours travaillés.
- **DailySnapshots** — Historique quotidien (date, totalWritten, writtenToday, dailyGoal, objectiveType, targetTotal, targetEndDate, progress, scenes counts, `writingMinutesToday?`). Mis à jour automatiquement à chaque `saveBook()`. Le champ `writingMinutesToday` est mis à jour par le timer d'écriture via `recordWritingMinutes()` et préservé lors de la reconstruction du snapshot.
- **CountUnit** — Unité de comptage choisie (`'words'` ou `'characters'`), configurable à la création du livre ou dans les paramètres
- **GlossaryEnabled** — Booléen activant le glossaire pour le livre. Quand activé, les entités (personnages, lieux, notes univers) marquées `inGlossary: true` apparaissent dans une section « Glossaire » dans le manuscrit, l'éditeur de scènes, les relectures et les exports (EPUB/PDF/DOCX). Le glossaire n'affiche plus le type de fiche (Personnage/Lieu/Univers), juste le nom et la description.
- **TableOfContents** — Booléen (`tableOfContents?` dans BookProject) pour inclure une table des matières dans les exports PDF et EPUB. N'apparaît pas dans le mode d'écriture. Les scènes des chapitres front/back matter apparaissent individuellement dans la TDM (uniquement si elles ont un titre). Configurable dans la page Chapitres & Scènes.
- **Layout** — Paramètres de mise en page du livre (`BookLayout`) : police (`BookFont`), taille (`BookFontSize` : 10-18pt), interligne (`BookLineHeight` : 1.0-2.0), et images de couverture (1ère de couverture et 4ème en base64 ; la tranche a été supprimée). Par défaut : Times New Roman 12pt, interligne 1.5. Ces paramètres s'appliquent à l'éditeur TipTap, au mode relecture, et aux exports EPUB/PDF. Polices disponibles : Times New Roman, Georgia, Garamond, Crimson Text, Lora, Merriweather, EB Garamond, Libre Baskerville (chargées via Google Fonts). L'éditeur permet de changer la police (`FontFamily`) ET la taille (`FontSize`, via `src/lib/font-size-extension.ts`) d'un texte sélectionné. Les titres h1/h2/h3 ont été retirés de la barre d'outils de l'éditeur de scènes. Un `onSelectionUpdate` force le re-rendu des sélecteurs police/taille pour refléter la sélection courante.

### Sagas

Les sagas permettent de regrouper plusieurs livres partageant une encyclopédie commune :
- **SagaMeta** — Métadonnées : id, titre, description, auteur, genre, nombre de livres, dates, writingMode, countUnit
- **SagaProject** — Données partagées : personnages, lieux, notes univers, cartes (même structure que dans BookProject)
- **Lien livre ↔ saga** : `BookProject.sagaId?` et `BookMeta.sagaId?` référencent la saga parente
- **useEncyclopediaStore** — Hook d'abstraction qui route les données encyclopédie vers `useSagaStore` (si le livre appartient à une saga) ou `useBookStore` (sinon). Les pages personnages, lieux, univers et cartes utilisent ce hook au lieu d'accéder directement aux stores.
- **useSagaStore** — Store Zustand dédié aux données partagées de la saga, avec sync cloud
- **Persistance** : `fabula-mea-saga-{sagaId}` en localStorage, `emlb:saga:{sagaId}` / `emlb:saga:{sagaId}:meta` en Redis
- **HomePage** : les livres peuvent être affichés par saga ou en liste plate

### Modes d'écriture (`WritingMode`)

- **`count`** — L'utilisateur renseigne manuellement le nombre de mots écrits par scène
- **`write`** — L'utilisateur écrit directement dans l'éditeur TipTap intégré (le comptage est automatique)

### Tickets

Les tickets sont globaux (pas liés à un livre). Système de feedback avec :
- Types : `bug`, `question`, `improvement`
- Module concerné : `TicketModule` — catégorise le ticket par section de l'application (auth, characters, places, chapters, timeline, writing, progress, world, maps, notes, reviews, settings, export, support, other)
- Visibilité : `public` (visible par tous) ou `private` (visible seulement par l'auteur et les admins)
- Statuts : `open`, `closed_done`, `closed_duplicate`
- Commentaires avec éditeur TipTap riche
- Réactions emoji
- Assignation optionnelle à une release
- Timeline d'activité (changements de statut, assignation release)
- **Filtres** : par type, statut (ouvert par défaut), module, et version (release). Le filtre version peut être pré-sélectionné via le paramètre URL `?releaseId={id}` (utilisé par le lien depuis ReleaseNotesPage). Le paramètre URL `?id={ticketId}` permet de pré-sélectionner un ticket (utilisé par les deep links des notifications)
- **Notification email** : à la création d'un ticket, un email est envoyé à tous les admins (via `sendTicketCreatedEmail`)
- **Notification in-app** : un commentaire sur un ticket crée une notification pour le créateur du ticket et tous les autres commentateurs. Les notifications non lues sont affichées via un badge sur le ticket dans la liste et sur le menu « Tickets » dans la sidebar. Aller sur un ticket marque automatiquement ses notifications comme lues.

### Notifications

Système de notifications in-app extensible, avec deux collections :
- **AppNotification** — Détails de la notification (type, acteur, message, lien, payload, recipientIds). Stockée dans une liste globale (max 200), partagée entre tous les utilisateurs.
- **Statut lu/non-lu par utilisateur** — Liste d'IDs de notifications lues, stockée par utilisateur. Séparation des responsabilités : modifier le statut lu d'un utilisateur ne touche pas la notification partagée.
- **Types** : `ticket_comment`, `review_comments_sent`, `review_completed`. Chaque type a une fonction de création dédiée qui calcule les destinataires.
- **Cloche** : icône `Bell` dans le header des deux sidebars (AppShell + HomeShell) + barres mobiles. Badge avec compteur de notifications non lues.
- **Modal** : clic sur la cloche → dropdown **positionnée en fixed** (calculée dynamiquement via `getBoundingClientRect` du bouton cloche pour éviter les débordements). Liste des notifications (plus récentes en premier), actions « Tout lire » et « Marquer comme lu » par notification. Clic sur une notification → navigation vers le lien + marque comme lu.
- **Badges sidebar** : le menu « Tickets » affiche le nombre total de notifications non lues de type ticket_comment. Chaque ticket dans la liste affiche aussi un badge avec son nombre de notifications non lues.
- **Auto-mark** : aller sur un TicketDetail marque automatiquement comme lues les notifications de ce ticket (via `markReadByPayload`).
- **Polling** : `useNotificationPolling` charge les notifications au montage et toutes les 60 secondes. Utilisé dans les deux sidebars. Quand le polling détecte de nouvelles notifications non lues (absentes du poll précédent), une notification locale du navigateur est affichée via `showLocalNotification()`.
- **Push navigateur** :
  - **Opt-in proactif** : une modale `PushOptInModal` (`src/components/notifications/PushOptInModal.tsx`) est affichée automatiquement à des moments clés — arrivée sur la page Tickets (après 1,5s) et après création d'une relecture (après 0,8s). La modale explique les bénéfices et propose « Activer » ou « Plus tard ». Si « Plus tard », la modale ne réapparaît qu'après 7 jours (`emlb-push-optin-dismissed` dans localStorage). Le bouton d'activation reste aussi disponible dans le modal de notifications.
  - **Dev** : utilise l'API `Notification` locale, déclenchée au polling quand de nouvelles notifications sont détectées dans le store.
  - **Prod** : Web Push via `web-push` (npm, dans `api/package.json`). `createNotification()` dans `api/_lib/notifications.ts` envoie automatiquement une push à chaque destinataire ayant une subscription enregistrée en Redis. Les subscriptions expirées (410 Gone) sont nettoyées automatiquement. Service worker (`public/sw.js`) gère l'affichage et le clic (navigation vers le lien).
  - **Variables d'environnement** : `VITE_VAPID_PUBLIC_KEY` (client + serveur), `VAPID_PRIVATE_KEY` (serveur uniquement). Génération via `npx web-push generate-vapid-keys`.
- **Cas d'usage** :
  - `ticket_comment` — Nouveau commentaire sur un ticket → notifie le créateur + tous les commentateurs précédents (hors auteur du commentaire)
  - `review_comments_sent` — Relecteur envoie ses commentaires → notifie l'auteur du livre
  - `review_completed` — Relecteur termine sa relecture → notifie l'auteur du livre
- **Messages templatés** : les messages sont stockés en base sous forme de templates à moustaches (ex: `{{actorName}} a commenté le ticket « {{ticketTitle}} »`). Les variables disponibles sont `actorName` (champ de la notification) + toutes les clés de `payload`. La résolution se fait via `resolveTemplate()` (`src/lib/utils.ts`) côté front (affichage + push locale) et côté serveur (Web Push body). Ce format est compatible i18n — il suffira de remplacer `resolveTemplate` par une fonction de traduction.
- **Architecture extensible** : pour ajouter un nouveau type de notification, (1) ajouter le type à `NotificationType`, (2) appeler `createNotification` au bon endroit côté dev-db et serverless avec un message templaté `{{var}}`, (3) optionnellement ajouter une icône dans `NotificationModal.TYPE_ICONS`.
- **Fichiers** : `src/store/useNotificationStore.ts`, `src/components/notifications/NotificationBell.tsx`, `src/components/notifications/NotificationModal.tsx`, `src/components/notifications/PushOptInModal.tsx`, `src/hooks/useNotificationPolling.ts`, `src/lib/push.ts`, `public/sw.js`, `api/notifications/[[...path]].ts`, `api/_lib/notifications.ts`

### Reviews (Relecture)

Système de relecture permettant à un auteur de partager des extraits de son livre avec des relecteurs externes :
- **Sessions** : l'auteur crée une session en sélectionnant des chapitres/scènes → un snapshot est figé
- **Accès par token** : chaque session a un token UUID unique → URL publique `/review/{token}` (pas d'auth requise)
- **Multi-email** : possibilité d'entrer plusieurs emails séparés par des virgules → une session par relecteur
- **Statuts** : `pending` → `in_progress` → `completed` → `closed`
  - `pending` : le relecteur n'a pas encore commencé (écran d'accueil avec saisie du nom)
  - `in_progress` : relecture en cours, le relecteur peut commenter
  - `completed` : le relecteur a marqué sa relecture comme terminée (il peut encore consulter en lecture seule)
  - `closed` : l'auteur clôture la session (le relecteur voit un écran "relecture clôturée")
- **Commentaires** : le relecteur sélectionne du texte → ajoute un commentaire → brouillon → envoi
  - Statuts commentaire : `draft` (brouillon, non visible par le destinataire), `sent` (envoyé), `closed` (résolu par l'auteur)
  - Réponses (replies) : threaded via `parentId`
  - L'auteur peut répondre et résoudre les commentaires
  - **Les commentaires de l'auteur** sont aussi en brouillon par défaut → envoi groupé via un bouton « Envoyer (N) » → email au relecteur (`sendAuthorRepliedEmail`)
- **Emails et notifications** :
  - Invitation de relecture (à la création de la session) → `sendReviewInviteEmail` (avec liste des fonctionnalités)
  - Relecteur envoie ses commentaires → `sendCommentsNotificationEmail` (email) + notification in-app `review_comments_sent` (à l'auteur, lien vers `reviews/{id}`)
  - Auteur envoie ses réponses → `sendAuthorRepliedEmail` (au relecteur, lien vers `review/{token}`)
  - Relecteur termine sa relecture → `sendReviewCompletedEmail` (email) + notification in-app `review_completed` (à l'auteur, lien vers `reviews/{id}`)
- **Highlights** : le texte commenté est surligné dans le contenu (via `injectHighlights` dans `src/lib/review-highlights.ts`)
- **Clic commentaire → scroll** : cliquer sur un commentaire scrolle vers le passage surligné dans le contenu
- **Panneau collapsible** : le plan (nav) et les commentaires sont collapsibles sur desktop, drawers sur mobile
- **Lecture seule** : quand la session est `completed`, le relecteur peut consulter mais plus commenter
- **Confirmation commentaires non envoyés** : l'auteur et le relecteur voient une modale de confirmation s'ils tentent de quitter avec des brouillons non envoyés. Côté auteur, `useBlocker` (react-router) intercepte toute navigation in-app + `beforeunload` pour la fermeture d'onglet
- **Filtres de statut** : la liste des relectures (auteur) dispose de filtres par statut (en attente, en cours, terminée, clôturée)
- **Indicateur commentaires en attente** : la page d'accueil (HomePage) et la sidebar affichent un badge sur les livres/relectures ayant des commentaires en attente (les sessions clôturées sont exclues du décompte)
- **Indicateur brouillons auteur** : la liste des relectures (ReviewsPage) affiche un indicateur amber « N réponse(s) non envoyée(s) » sur les sessions ayant des brouillons auteur (`authorDraftCount` dans `ReviewSession`, calculé côté API)
- **Vue auteur plein écran** : la page `ReviewAuthorView` (`/reviews/:id`) est routée directement sous `RootLayout` (pas de HomeShell) pour occuper tout l'écran, comme la page relecteur
- **Confirmation de clôture** : le bouton « Clôturer » côté auteur demande confirmation via une modale
- **TicketBubble masquée** : la bulle de création de ticket est affichée uniquement sur la HomePage. La création de ticket est accessible via le menu « Aide & Support » dans la sidebar

### Releases

Système de gestion des versions de l'application :
- Statuts : `draft` → `planned` → `current` → `released`
- Les drafts ne sont visibles que par les admins
- Auto-demotion : quand une release passe en `current`, l'ancienne `current` devient `released`
- Chaque release a des items typés (`bugfix`, `improvement`, `feature`)
- Peut être liée à des tickets
- **Contributeurs** : l'API `/tickets` retourne un champ `releaseContributors` (mapping `releaseId → userName[]`) calculé à partir de **tous** les tickets (y compris privés), pour que la section « Merci aux contributeurs » dans ReleaseNotesPage affiche tous les noms, même ceux ayant uniquement créé des tickets privés
- **Tickets liés** : chaque release dans ReleaseNotesPage affiche le nombre de tickets liés avec un lien vers `/tickets?releaseId={id}` pour voir la liste filtrée

---

## Persistance locale (`useBookStore` + `useLibraryStore`)

### Architecture de synchronisation

Le serveur est la **source de vérité**. Le localStorage sert de **cache** pour un affichage instantané. La sauvegarde cloud est **obligatoire avec retry** (pas fire-and-forget).

```
saveBook() → localStorage.setItem(key, json)   ← toujours (cache immédiat)
           → cloudSaveWithRetry(api.books.save) ← obligatoire si token JWT présent (3 tentatives, backoff exponentiel 1s/2s/4s)
```

**`cloudSaveWithRetry`** : 3 tentatives avec backoff exponentiel (1s, 2s, 4s). Si les 3 échouent → `useSyncStore.setError()` avec message visible dans la sidebar.

**Debounce auto-save** : un subscriber Zustand écoute `updatedAt` et déclenche `saveBook()` après 500ms de debounce. `cancelPendingSave()` annule le debounce en cours (appelé dans `loadBook` et `unloadBook` pour éviter les sauvegardes cross-book).

**Guards anti-stale** :
- `bookIdAtSave` : le `saveBook` capture l'id au moment de l'appel et vérifie qu'on est toujours sur le même livre quand la promesse se résout
- `loadedAt` : le `loadBook` capture `updatedAt` au chargement et ne remplace les données locales par les données cloud que si l'utilisateur n'a pas édité entre-temps

### Historique des versions

Snapshots automatiques toutes les **15 minutes** (dedup par timestamp), max **20 versions** par livre. Stocké en Redis LIST (prod) ou localStorage array (dev).

- **Stats** : chapitres, scènes, événements, mots, personnages, lieux, notes univers, cartes, notes & idées
- **Saga data** : si le livre appartient à une saga, les données partagées (personnages, lieux, etc.) sont incluses dans le snapshot
- **Restauration** : sauvegarde l'état actuel comme point de restauration (`isRestore: true`) avant de restaurer, puis `window.location.reload()` pour un état propre
- **UI** : section dépliable dans SettingsPage, badges de diff entre versions, badge ambre "avant restauration"
- **Clés** : `emlb-dev:u:{userId}:book:{bookId}:history` (dev) / `emlb:u:{userId}:book:{bookId}:history` (prod, Redis LIST)

### Clés localStorage (côté client, indépendant du mode dev/prod)

- `fabula-mea-library` — Bibliothèque (persist Zustand, contient les BookMeta[] et SagaMeta[])
- `fabula-mea-book-{bookId}` — Données complètes d'un livre
- `fabula-mea-saga-{sagaId}` — Données partagées d'une saga (SagaProject)
- `emlb-token` — Token JWT (prod) ou token dev (dev)
- `emlb-last-seen-version` — Dernière version vue (pour badge "Nouveau" sur releases)
- `emlb-daily-snapshot:{bookId}` — Snapshot du total de mots/signes en début de journée (suivi progression journalière)
- `fabula-mea-writing-timer` — État persistant du timer d'écriture (mode, durée, sessions, accumulatedWritingSeconds, etc.)
- `fabula-mea-spotify` — Tokens OAuth Spotify (accessToken, refreshToken, expiresAt)
- `fabula-mea-spotify-playlist` — Playlist Spotify sélectionnée (id, name, uri, trackCount)
- `fabula-mea-spotify-verifier` — Code verifier PKCE temporaire (supprimé après échange)
- `emlb-push-optin-dismissed` — Date de dernière fermeture de la modale push opt-in (réapparaît après 7 jours)

### Synchronisation cloud

Le store `useSyncStore` track l'état de sync : `idle | syncing | synced | error`.
La sync est déclenchée à chaque `saveBook()` si un token est présent dans localStorage (`emlb-token`).

Au chargement d'un livre (`loadBook`), le store :
1. Charge depuis localStorage (cache immédiat). Si pas de cache, initialise un état minimal avec `id: bookId` pour que le fetch serveur puisse s'appliquer
2. Fetch depuis le serveur en parallèle (source de vérité)
3. Applique les données cloud — sauf si l'utilisateur a déjà édité (guard `loadedAt`)

---

## Conventions de code

### Style

- **Tailwind CSS** exclusivement, pas de fichiers CSS custom (sauf `index.css` pour les directives)
- Palette custom : `parchment` (fond parchemin), `ink` (texte foncé), `bordeaux` (accents rouges), `gold` (accents dorés)
- Polices : `font-serif` (Crimson Text), `font-display` (Playfair Display), `font-sans` (Inter)
- Icônes : `lucide-react` uniquement

### Composants

- Composants fonctionnels React avec hooks
- TypeScript strict, pas de `any`
- Pattern : `interface Props { ... }` puis `export function Component({ ... }: Props)`
- Les pages importent les stores via hooks Zustand : `const items = useMyStore((s) => s.items)`

### Imports

- Alias `@/` = `src/` (configuré dans `vite.config.ts` et `tsconfig.json`)
- Exemple : `import { api } from '@/lib/api'`

### IDs

- Générés via `crypto.randomUUID()` (wrapper dans `src/lib/utils.ts` : `generateId()`)
- Timestamps via `new Date().toISOString()` (wrapper : `now()`)

---

## Commandes

```bash
npm run dev      # Démarre le serveur Vite en mode dev (port 5174)
npm run build    # Build TypeScript + Vite pour production
npm run preview  # Preview du build en local
npm test         # Lance les tests unitaires (Vitest)
npm run test:watch  # Tests en mode watch
```

---

## Déploiement

- Hébergé sur **Vercel**
- `vercel.json` configure :
  - `buildCommand: "npm run build"` 
  - `outputDirectory: "dist"`
  - Rewrite SPA : toutes les routes non-API redirigent vers `index.html`
- Les serverless functions dans `api/` sont automatiquement déployées par Vercel
- Le dossier `api/` a son propre `package.json` avec `"type": "commonjs"` (requis par Vercel)

---

## Points d'attention

1. **Toujours modifier les deux côtés** : `dev-db.ts` ET le endpoint `api/` correspondant pour toute fonctionnalité data.
2. **La façade `api.ts`** doit avoir le ternaire `IS_DEV` pour chaque nouvelle méthode.
3. **Les clés Redis** en prod n'ont PAS le préfixe `dev:` — voir `api/_lib/redis.ts` vs `src/lib/dev-db.ts`.
4. **Les serverless functions** sont en **CommonJS** (`module.exports`, pas `export default`). Le `tsconfig.json` dans `api/` gère ça. Les endpoints sont regroupés en **catch-all routes** (`[[...path]].ts`) pour respecter la limite de 12 fonctions du plan Hobby Vercel (11 fonctions actuellement). Voir `api/CLAUDE.md` pour le détail du routing interne.
5. **CORS** : chaque endpoint prod doit appeler `handleCors(req, res)` en premier.
6. **Auth** : chaque endpoint protégé doit appeler `requireAuth(req, res)` qui retourne `{ userId }` ou `null`.
7. **Le `useBookStore`** est le store le plus complexe (~1450 lignes). Il gère tout le contenu d'un livre et auto-save en local + cloud. Il interagit avec `useSagaStore` pour charger/décharger les données de saga quand un livre appartient à une saga.
8. **TipTap** est utilisé pour l'éditeur de scènes, les descriptions de tickets, les notes & idées (avec checklists via TaskList/TaskItem), et les commentaires. Les toolbars sont dans les composants editor. Les styles TaskList sont dans `index.css`. Extensions `@tiptap/extension-text-style`, `@tiptap/extension-font-family` et `src/lib/font-size-extension.ts` (custom) permettent de changer la police et la taille d'un texte sélectionné dans l'éditeur de scènes. Les titres h1/h2/h3 ont été retirés de la barre d'outils. Le collage de texte externe est nettoyé (suppression des styles inline via `transformPastedHTML`).
9. **La page relecteur** (`/review/:token`) est publique et accessible sans authentification. La `TicketBubble` et le `TicketForm` sont masqués pour les utilisateurs non connectés.
10. **Les sessions de relecture** figent un snapshot des chapitres/scènes au moment de la création. Les modifications ultérieures du livre n'affectent pas les relectures en cours.
11. **Les commentaires de relecture** ont un workflow draft → sent → closed. Le relecteur ET l'auteur créent des brouillons, les envoient explicitement (envoi groupé), et l'auteur peut résoudre les commentaires.
12. **Redirection post-login** : si un utilisateur non connecté tente d'accéder à une page (ex: lien email `reviews/{id}`), l'URL est sauvegardée dans `sessionStorage` (`emlb-redirect-after-login`) et l'utilisateur est redirigé après connexion.
13. **Emails** : en prod, les emails sont envoyés via Resend (`api/_lib/email.ts`). En dev, `devEmailLog()` dans `dev-db.ts` affiche les emails simulés dans la console du navigateur.
14. **TicketBubble** : affichée uniquement sur la HomePage (quand aucun livre n'est sélectionné). Dans les pages livre, la création de ticket se fait via le menu « Aide & Support » dans la sidebar.
15. **Sidebar** : la navigation livre commence par un lien top-level « Vue d'ensemble » (tableau de bord), puis des groupes dépliables — Encyclopédie (Personnages, Lieux, Cartes, Univers), Manuscrit (Chronologie, Chapitres, Relectures, Édition), Suivi (Progression, Objectifs), Notes & Idées, Paramètres, et Aide & Support (Créer un ticket avec style bouton, Tickets). L'expansion automatique suit la route active. La sélection d'un livre redirige vers `/encyclopedia` (tableau de bord). La Chronologie est en première position du groupe Manuscrit car c'est souvent la première étape de conception d'un livre.
16. **Timeline (filtrage doux)** : les filtres de la chronologie ne masquent plus les scènes non correspondantes, elles sont affichées avec une opacité réduite (`opacity-20`). L'axe temporel et les rangées restent stables.
17. **ImageUpload rond** : le composant `ImageUpload` supporte un mode `round` avec un bouton « Recadrer » pour entrer en mode crop (drag-to-pan vertical, `offsetY`) et un bouton « Valider » pour confirmer. Utilisé pour les avatars de personnages. Un composant `CharacterAvatar` (`src/components/characters/CharacterAvatar.tsx`) affiche l'avatar rond avec `imageOffsetY` en différentes tailles (8/10/12/16/32), utilisé dans CharacterDetail, CharacterCard et RelationshipGraph.
18. **Confirmation modifications non sauvegardées** : le formulaire de personnage (CharacterForm) affiche une modale à 3 boutons (Annuler/Quitter/Enregistrer) si l'utilisateur tente de fermer avec des modifications non sauvegardées.
19. **Mettre à jour ce fichier** : après toute modification du code (nouvelle fonctionnalité, changement d'architecture, nouveau type, nouvel endpoint…), vérifier si des informations de ce `CLAUDE.md` (et `api/CLAUDE.md`) doivent être mises à jour pour rester en phase avec le code (structure des fichiers, modèle de données, clés de stockage, points d'attention, etc.).
19b. **Toujours faire une review du code** : après chaque implémentation, relire le code modifié pour vérifier : doublons de logique, cleanups d'effets manquants (timeouts, listeners), race conditions entre effets React, cohérence avec les patterns existants du projet, et absence de régressions. Ne pas se contenter du `tsc --noEmit` qui ne vérifie que les types.
20. **Glossaire** : le glossaire est une fonctionnalité transversale activable par livre (`glossaryEnabled` dans `BookProject`). Les entités (Character, Place, WorldNote) ont un champ `inGlossary?: boolean`. Le glossaire est affiché dans : ChaptersPage (section collapsible après « Après l'histoire »), SceneEditor (entrée nav + section read-only en bas), relectures (nav + contenu via `snapshot.glossary`), et exports EPUB/PDF. **Le type de fiche n'est plus affiché en texte dans le glossaire** (ni dans l'éditeur, ni dans les relectures, ni dans les exports). Dans ChaptersPage, chaque entrée du glossaire affiche une **icône de type** à gauche (User/MapPin/Globe) et un **bouton de navigation** vers la fiche correspondante ; la description n'est pas affichée. Un indicateur visuel (icône `BookText`) apparaît dans les listes et fiches des personnages, lieux et notes univers quand `inGlossary === true`.
21. **Création de relecture** : les scènes avec statut `outline` (plan) ou `draft` (brouillon) ne peuvent pas être sélectionnées. Le statut est affiché à côté de chaque scène.
22. **Changement de statut de scène** : peut se faire directement depuis la liste des scènes (ChaptersPage) via un select inline, sans avoir à ouvrir la fiche de modification. Également disponible dans le **mode écriture** (SceneEditor) : un sélecteur de statut apparaît à droite de chaque en-tête de scène, permettant de changer le statut sans quitter l'éditeur.
23. **Couvertures et page de titre** : la 1ère de couverture et la page de titre (titre + auteur) apparaissent dans le manuscrit (ChaptersPage), les relectures (nav « Page de titre » + contenu), le PDF (avant la page de titre) et l'EPUB (métadonnées OPF `properties="cover-image"`). La 4ème de couverture apparaît à la fin dans le manuscrit, les relectures (nav « 4ème de couverture ») et le PDF. Dans l'EPUB, seule la 1ère de couverture est intégrée aux métadonnées. La tranche a été supprimée des paramètres.
24. **Table des matières** : activable via `tableOfContents` dans `BookProject` (checkbox tout en haut de la page ChaptersPage, avant « Avant l'histoire »). Apparaît dans PDF, EPUB et DOCX. Les chapitres front/back matter sont éclatés en entrées individuelles par scène (seulement celles avec titre). Les numéros de page sont générés via CSS `target-counter()` dans le PDF.
25. **Images et CDN** : les images (avatars personnages, lieux, notes univers, cartes, couvertures) sont stockées sur **Vercel Blob** (CDN) en production et en **base64 dans localStorage** en développement. Le helper `src/lib/upload.ts` (`uploadImage()`) gère la logique : en dev → retourne le base64 tel quel, en prod → upload vers `/api/upload` → retourne l'URL CDN publique. La **migration lazy** dans `useBookStore.saveBook()` détecte les images base64 restantes et les upload automatiquement au CDN avant la sync cloud. Les champs `imageUrl` et `coverFront`/`coverBack` acceptent indifféremment un base64 ou une URL HTTP (rétrocompatibilité). L'export EPUB utilise `resolveImageData()` qui gère les deux formats (fetch URL ou parse base64). L'export PDF fonctionne nativement avec les URLs via `<img src="...">`. Variable d'environnement requise : `BLOB_READ_WRITE_TOKEN`.
26. **Sagas** : le système de sagas permet de regrouper plusieurs livres dans une collection avec une encyclopédie partagée (personnages, lieux, univers, cartes). Le `useEncyclopediaStore` est un hook d'abstraction critique qui route les données encyclopédie vers `useSagaStore` ou `useBookStore` selon que le livre appartient à une saga. La HomePage affiche les livres regroupés par saga.
27. **Timer d'écriture** : le composant `FloatingWritingTimer` (`src/components/progress/FloatingWritingTimer.tsx`) remplace l'ancien `FloatingPomodoro`. Il propose 3 modes : **Session libre** (chronomètre ascendant, pas d'alarme), **Minuteur** (décompte depuis une durée choisie : 15min–2h), **Pomodoro** (alternance 25min travail / 5min pause). Le temps d'écriture est comptabilisé via `useWritingTimer` (`src/hooks/useWritingTimer.ts`) et enregistré dans `DailySnapshot.writingMinutesToday` via `useBookStore.recordWritingMinutes()`. Le bouton flottant n'affiche que l'icône par défaut ; le temps apparaît au survol ou quand le timer tourne. Supporte le **Document Picture-in-Picture API** (Chrome/Edge 116+) pour une fenêtre flottante persistante. État persisté dans `localStorage` (`fabula-mea-writing-timer`). Migration automatique depuis l'ancien format `fabula-mea-pomodoro`. **Alarmes sonores** : Web Audio API — triple carillon pour fin de travail/minuteur, double tonalité douce pour fin de pause.
28. **Profil utilisateur** : page `/profile` accessible depuis HomeShell. Permet de modifier nom, email, avatar (avec recadrage rond), et mot de passe. Endpoints API : `PATCH /api/auth/profile`, `POST /api/auth/change-password`, `DELETE /api/auth/account`.
29. **Page Édition** : page `/edition` dans AppShell. Regroupe la mise en page (polices, taille, interligne), les couvertures, la table des matières, et les exports (EPUB, PDF, DOCX).
30. **Ordre des personnages** : les personnages ont un champ `order?` qui définit leur position dans la liste. La page Personnages (`CharactersPage`) permet de les réordonner par drag-and-drop (`@dnd-kit`, `rectSortingStrategy`). Cet ordre est utilisé dans la chronologie (`TimelinePage`) pour afficher les rangées de personnages dans l'ordre choisi (personnages importants en premier). Le drag-and-drop est désactivé quand une recherche est active. Le `reorderCharacters` est disponible dans `useBookStore`, `useSagaStore` et `useEncyclopediaStore`.
31. **Titres de scènes dans les exports** : les titres de scènes (`scene.title`) apparaissent dans les exports EPUB, PDF et DOCX pour **tous les chapitres** (y compris ceux avec une seule scène), pas seulement pour les chapitres front/back matter. Dans les relectures, les titres de scènes sont toujours affichés.
32. **Graphe des relations** : les edges du graphe (`RelationshipGraph`) normalisent `source`/`target` par tri d'ID pour garantir que les courbes entre une même paire de personnages aillent toujours dans la même direction perpendiculaire, quel que soit l'ordre d'itération des personnages. Le champ `arrowTarget` stocke la vraie cible des relations non réciproques pour dessiner la flèche dans le bon sens.
33. **Correction problème dates < 1000** : les dates de la chronologie supportent les années < 1000 (ex: 0157 pour un roman historique/fantasy). Lors de la conversion `Date → string YYYY-MM-DD`, toujours utiliser `String(d.getFullYear()).padStart(4, '0')` pour conserver les zéros de tête. Les endroits concernés : `insertTimelineEvent`, `splitTimelineEvent` dans `useBookStore.ts`, et `handleMouseUp` (drag/resize) dans `TimelinePage.tsx`.
34. **Synchronisation cloud robuste** : la sauvegarde cloud utilise `cloudSaveWithRetry` (3 tentatives, backoff exponentiel). Le `loadBook` initialise un état minimal (`id: bookId`) même sans cache localStorage, pour que les données du serveur puissent s'appliquer. Des guards (`bookIdAtSave`, `loadedAt`) empêchent les promesses stale de corrompre l'état. Le debounce est annulé (`cancelPendingSave()`) lors du changement de livre.
35. **Tests unitaires** : Vitest en environnement `node`. Tests dans `src/__tests__/` (8 fichiers, ~195 tests). Couvrent : retry avec backoff (`cloudSaveWithRetry`), historique de versions (extractStats, dedup, restore, saga data), optimisation daily snapshot, calculs de progression et objectifs (`calculations.ts`), fonctions utilitaires (`utils.ts` : durées, comptage mots/signes, labels chapitres, formatage), CRUD encyclopédie (`encyclopedia-helpers.ts` : personnages, lieux, tags, worldNotes, maps, pins, relations, keyEvents), sanitization export XHTML (`export-shared.ts` : escapeXml, cleanHtml), helpers upload (`upload.ts` : isBase64, isUrl). Voir `src/__tests__/CLAUDE.md` pour les détails.
36. **Lecteur Spotify intégré** : un bouton flottant dans `AppShell` permet d'écouter ses playlists Spotify pendant l'écriture. **Accès contrôlé par admin** : Spotify est en mode développeur (limité à 25 utilisateurs manuellement ajoutés). Pour contourner cette limitation, chaque utilisateur a un champ `spotifyEnabled?: boolean` (défaut `false`). Seuls les admins peuvent activer/désactiver Spotify pour un utilisateur via `AdminMembersPage` (bouton toggle par membre). Le `FloatingSpotifyPlayer` n'est rendu dans `AppShell` que si `user.spotifyEnabled === true` (lu depuis `useAuthStore`). Architecture : `src/lib/spotify.ts` (OAuth PKCE, API playlists, persistance tokens), `src/hooks/useSpotifyPlayer.ts` (Web Playback SDK, device discovery), `src/components/progress/FloatingSpotifyPlayer.tsx` (UI panneau + bulle), `src/pages/SpotifyCallbackPage.tsx` (popup OAuth). **Endpoints** : `PATCH /api/admin/members` (toggle `spotifyEnabled` pour un utilisateur, admin requis), `devAuth.setSpotifyEnabled()` en dev. Le champ `spotifyEnabled` est retourné par `/api/auth/login`, `/api/auth/signup`, `/api/auth/me`, `/api/auth/profile`. **Particularités techniques** : (1) OAuth PKCE sans client secret — le `code_verifier` est stocké en `localStorage` (pas `sessionStorage`) car la popup OAuth ne partage pas le `sessionStorage` avec la fenêtre parente ; (2) Spotify interdit `localhost` dans les redirect URIs depuis avril 2025, le code remplace automatiquement `localhost` par `127.0.0.1` et `vite.config.ts` utilise `host: true` ; (3) `main.tsx` redirige `localhost` → `127.0.0.1` quand Spotify est configuré pour que les deux fenêtres partagent la même origine ; (4) le `device_id` du SDK ne correspond pas toujours à celui de l'API REST — le hook requête `GET /me/player/devices` pour trouver le vrai ID par nom ; (5) le play utilise un retry (5 tentatives, 1s d'intervalle) car le backend Spotify peut mettre quelques secondes à enregistrer un nouveau device. Requiert **Spotify Premium**. Variable : `VITE_SPOTIFY_CLIENT_ID`.
37. **Bouton « Écrire » et navigation vers l'éditeur** : dans `ChaptersPage`, chaque scène (en mode `write`) affiche un bouton bordeaux « Écrire » (avec icône `PenLine` + texte) bien distinct de l'icône crayon de modification. Ce bouton appelle `useEditorStore.open(sceneId)` qui ouvre `SceneEditor` en positionnant le curseur à la **fin du contenu** de la scène et en scrollant vers le curseur (via `scrollIntoView({ block: 'center' })`). Un mécanisme de retry (10 tentatives, 100ms) attend que TipTap soit monté avant de tenter le scroll/focus. Le cleanup de l'effet annule les retries en cours via un flag `cancelled`.
38. **Réorganisation des scènes par drag-and-drop** : la page `ChaptersPage` permet de réordonner les scènes par drag-and-drop (`@dnd-kit`, `verticalListSortingStrategy`, `pointerWithin`). Les scènes peuvent être déplacées **au sein du même chapitre** (réordonnancement) ou **entre chapitres différents** (déplacement). La prévisualisation est identique dans les deux cas : un état virtuel (`virtualSceneIds`) permet d'afficher la scène à sa future position en temps réel pendant le drag. Composants impliqués : `SortableSceneItem` (scène draggable), `DroppableSceneList` (zone de drop pour liste de scènes), `DroppableChapter` (zone de drop pour chapitre entier/header). Store : `reorderScenes(chapterId, sceneIds[])` pour réordonnancement intra-chapitre, `moveScene(sceneId, toChapterId, newIndex)` pour déplacement inter-chapitres. Sauvegarde automatique via le subscriber `updatedAt` → `saveBook()` (debounce 500ms).
