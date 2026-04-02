# CLAUDE.md — Fabula Mea

## Vue d'ensemble

**Fabula Mea** est une application web d'aide à l'écriture de livres. Elle permet de structurer un projet de roman : personnages, lieux, chapitres, scènes, worldbuilding, cartes, timeline, objectifs de progression, export EPUB/PDF. L'application inclut aussi un système de tickets (bug/amélioration/question), de releases, et un panneau d'administration.

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
- `StandaloneShell` — Pages indépendantes du livre (header compact avec logo)
- `AdminShell` — Pages d'administration
- Route directe sous `RootLayout` — Pages plein écran (ex: `HomePage`)

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
| Export | JSZip + file-saver | — |
| Hébergement | Vercel (SPA + serverless) | — |
| Base de données | Upstash Redis (prod) / localStorage (dev) | — |
| Stockage images | Vercel Blob (prod) / base64 localStorage (dev) | — |

---

## Structure des fichiers

```
/
├── CLAUDE.md                    ← Ce fichier
├── package.json                 ← Scripts: dev, build, preview
├── vite.config.ts               ← Port 5174, alias @ → ./src
├── tailwind.config.js           ← Couleurs custom (parchment, ink, bordeaux, gold)
├── vercel.json                  ← SPA rewrite, buildCommand, outputDirectory
├── tsconfig.json
│
├── api/                         ← Serverless functions (Vercel) — CommonJS, catch-all routes
│   ├── CLAUDE.md                ← Doc spécifique API
│   ├── package.json             ← { "type": "commonjs" }
│   ├── _lib/                    ← Utilitaires partagés (auth, cors, redis, email)
│   ├── auth/[[...path]].ts      ← signup, login, me, forgot-password, reset-password (catch-all)
│   ├── book/[bookId].ts         ← CRUD livre par utilisateur
│   ├── tickets/[[...path]].ts   ← CRUD tickets + commentaires + réactions (catch-all)
│   ├── releases/[[...path]].ts  ← CRUD releases (catch-all)
│   ├── admin/members.ts         ← Endpoints admin (membres)
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
│   ├── types/
│   │   └── index.ts             ← Tous les types TypeScript (~422 lignes)
│   │
│   ├── lib/
│   │   ├── api.ts               ← ⭐ Façade API (IS_DEV ternaire)
│   │   ├── dev-auth.ts          ← Mock auth localStorage
│   │   ├── dev-db.ts            ← Mock DB localStorage
│   │   ├── redis.ts             ← Client Upstash côté client (sync directe)
│   │   ├── utils.ts             ← Helpers (generateId, now, CHAPTER_COLORS, countCharacters, countUnitLabel, isSpecialChapter, getChapterLabel...)
│   │   ├── calculations.ts      ← Calculs progression (mots/jour, scènes/jour, getTodayProgress, dailySnapshot)
│   │   ├── fonts.ts             ← Config polices (FONT_STACKS, AVAILABLE_FONTS, DEFAULT_LAYOUT)
│   │   ├── upload.ts            ← Helper upload images (CDN en prod, base64 en dev)
│   │   ├── export-epub.ts       ← Génération EPUB 3
│   │   ├── export-pdf.ts        ← Export PDF via window.print()
│   │   ├── migration.ts         ← Migration single-book → multi-book
│   │   └── spellcheck-extension.ts ← Extension TipTap correcteur
│   │
│   ├── store/
│   │   ├── useAuthStore.ts      ← Authentification (login/signup/logout)
│   │   ├── useLibraryStore.ts   ← Bibliothèque multi-livres (persist Zustand)
│   │   ├── useBookStore.ts      ← ⭐ Store principal (~965 lignes) : tout le contenu du livre
│   │   ├── useEditorStore.ts    ← État éditeur de scène (open/close/entrySceneId)
│   │   ├── useSyncStore.ts      ← Statut synchronisation cloud
│   │   ├── useTicketStore.ts    ← CRUD tickets + commentaires + réactions
│   │   ├── useReleaseStore.ts   ← CRUD releases
│   │   └── useReviewStore.ts    ← CRUD sessions de relecture + commentaires
│   │
│   ├── pages/                   ← Pages de l'application
│   │   ├── HomePage.tsx         ← Accueil / sélection de livre (badge commentaires en attente)
│   │   ├── EncyclopediaPage.tsx ← ⭐ Tableau de bord du livre (stats, objectif du jour, manuscrit, relectures, encyclopédie)
│   │   ├── CharactersPage.tsx   ← Gestion personnages
│   │   ├── PlacesPage.tsx       ← Gestion lieux
│   │   ├── ChaptersPage.tsx     ← Chapitres + scènes + éditeur
│   │   ├── TimelinePage.tsx     ← Frise chronologique (vue par personnage OU par lieu, filtres croisés, filtrage doux par opacité)
│   │   ├── ProgressPage.tsx     ← Progression + objectifs + Pomodoro + suivi journalier
│   │   ├── WorldPage.tsx        ← Notes de worldbuilding
│   │   ├── MapsPage.tsx         ← Cartes interactives
│   │   ├── NotesIdeasPage.tsx   ← Notes & idées (grille de cartes, TipTap avec toolbar complète + checklists)
│   │   ├── SettingsPage.tsx     ← Paramètres + export + import
│   │   ├── TicketsPage.tsx      ← Tickets/feedback
│   │   ├── ReleaseNotesPage.tsx ← Notes de version
│   │   ├── ReviewsPage.tsx      ← Liste des sessions de relecture (auteur, filtres par statut)
│   │   ├── AuthPage.tsx         ← Login/Inscription
│   │   ├── review/
│   │   │   └── ReviewReaderPage.tsx ← Page publique relecteur (sans auth)
│   │   └── reviews/
│   │       └── ReviewAuthorView.tsx ← Vue détaillée relecture (auteur)
│   │
│   └── components/
│       ├── layout/
│       │   ├── AppShell.tsx     ← Layout livre (sidebar + contenu)
│       │   ├── Sidebar.tsx      ← Navigation livre
│       │   ├── StandaloneShell.tsx ← Layout autonome (tickets, releases)
│       │   ├── AdminShell.tsx   ← Layout admin
│       │   └── SearchDialog.tsx ← Recherche globale (Cmd+K)
│       ├── editor/              ← Éditeur TipTap (SceneEditor, SceneInlineEditor, EditorTabs)
│       ├── characters/          ← Fiches personnages, relations, graphe, CharacterAvatar (composant réutilisable avatar rond)
│       ├── maps/                ← Viewer de cartes, épingles
│       ├── progress/            ← Pomodoro, stats
│       ├── shared/              ← ConfirmDialog, EmptyState, ImageUpload (mode rond avec recadrage), TagBadge
│       ├── tickets/             ← TicketBubble (affichée uniquement sur la HomePage), TicketForm
│       ├── releases/            ← NewReleaseModal, composants release
│       └── reviews/             ← NewReviewDialog, ReviewCommentPanel, ReviewContentViewer
```

---

## Modèle de données

### Entités d'un livre (`BookProject`)

Un livre contient :
- **Characters** — Personnages avec relations mutuelles, évolution, événements clés, avatar rond avec `imageOffsetY` (pourcentage 0-100 pour le centrage vertical de l'image)
- **Places** — Lieux typés (ville, bâtiment, paysage...) avec connexions
- **Chapters** — Chapitres ordonnés, contenant des scènes. Trois types via `ChapterType` :
  - `front_matter` — Section « Avant l'histoire » (dédicace, prologue, etc.) — number 0, créé automatiquement
  - `chapter` — Chapitre classique numéroté (type par défaut)
  - `back_matter` — Section « Après l'histoire » (épilogue, remerciements, etc.) — number 99999, créé automatiquement
  - Les chapitres front/back matter ne peuvent pas être supprimés ni réordonnés. Ils s'affichent avant/après les chapitres normaux dans l'UI et les exports.
- **Scenes** — Scènes avec statut (outline/draft/revision/complete), personnages, lieu, contenu TipTap
- **Tags** — Système d'étiquettes réutilisables
- **WorldNotes** — Notes de worldbuilding catégorisées
- **NoteIdeas** — Notes et idées libres avec éditeur TipTap (toolbar complète : titres, formatage, alignement, listes, checklists, citations, images, liens), affichées en grille de cartes avec aperçu HTML du contenu (titre facultatif, contenu obligatoire), vue détail au clic
- **Maps** — Cartes avec épingles liées aux lieux
- **ProjectGoals** — Objectifs (date cible, mots/scène, objectif journalier, périodes exclues)
- **WritingSessions** — Historique des sessions d'écriture
- **CountUnit** — Unité de comptage choisie (`'words'` ou `'characters'`), configurable à la création du livre ou dans les paramètres
- **GlossaryEnabled** — Booléen activant le glossaire pour le livre. Quand activé, les entités (personnages, lieux, notes univers) marquées `inGlossary: true` apparaissent dans une section « Glossaire » dans le manuscrit, l'éditeur de scènes, les relectures et les exports (EPUB/PDF). Le glossaire n'affiche plus le type de fiche (Personnage/Lieu/Univers), juste le nom et la description.
- **TableOfContents** — Booléen (`tableOfContents?` dans BookProject) pour inclure une table des matières dans les exports PDF et EPUB. N'apparaît pas dans le mode d'écriture. Les scènes des chapitres front/back matter apparaissent individuellement dans la TDM (uniquement si elles ont un titre). Configurable dans la page Chapitres & Scènes.
- **Layout** — Paramètres de mise en page du livre (`BookLayout`) : police (`BookFont`), taille (`BookFontSize` : 10-18pt), interligne (`BookLineHeight` : 1.0-2.0), et images de couverture (1ère de couverture et 4ème en base64 ; la tranche a été supprimée). Par défaut : Times New Roman 12pt, interligne 1.5. Ces paramètres s'appliquent à l'éditeur TipTap, au mode relecture, et aux exports EPUB/PDF. Polices disponibles : Times New Roman, Georgia, Garamond, Crimson Text, Lora, Merriweather, EB Garamond, Libre Baskerville (chargées via Google Fonts). L'éditeur permet de changer la police (`FontFamily`) ET la taille (`FontSize`, via `src/lib/font-size-extension.ts`) d'un texte sélectionné. Les titres h1/h2/h3 ont été retirés de la barre d'outils de l'éditeur de scènes. Un `onSelectionUpdate` force le re-rendu des sélecteurs police/taille pour refléter la sélection courante.

### Modes d'écriture (`WritingMode`)

- **`count`** — L'utilisateur renseigne manuellement le nombre de mots écrits par scène
- **`write`** — L'utilisateur écrit directement dans l'éditeur TipTap intégré (le comptage est automatique)

### Tickets

Les tickets sont globaux (pas liés à un livre). Système de feedback avec :
- Types : `bug`, `question`, `improvement`
- Module concerné : `TicketModule` — catégorise le ticket par section de l'application (auth, characters, places, chapters, timeline, progress, world, maps, notes, reviews, settings, export, other)
- Visibilité : `public` (visible par tous) ou `private` (visible seulement par l'auteur et les admins)
- Statuts : `open`, `closed_done`, `closed_duplicate`
- Commentaires avec éditeur TipTap riche
- Réactions emoji
- Assignation optionnelle à une release
- Timeline d'activité (changements de statut, assignation release)
- **Notification email** : à la création d'un ticket, un email est envoyé à tous les admins (via `sendTicketCreatedEmail`)

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
- **Emails de notification** :
  - Invitation de relecture (à la création de la session) → `sendReviewInviteEmail` (avec liste des fonctionnalités)
  - Relecteur envoie ses commentaires → `sendCommentsNotificationEmail` (à l'auteur, lien vers `reviews/{id}`)
  - Auteur envoie ses réponses → `sendAuthorRepliedEmail` (au relecteur, lien vers `review/{token}`)
  - Relecteur termine sa relecture → `sendReviewCompletedEmail` (à l'auteur, lien vers `reviews/{id}`)
- **Highlights** : le texte commenté est surligné dans le contenu (via `injectHighlights` dans `src/lib/review-highlights.ts`)
- **Clic commentaire → scroll** : cliquer sur un commentaire scrolle vers le passage surligné dans le contenu
- **Panneau collapsible** : le plan (nav) et les commentaires sont collapsibles sur desktop, drawers sur mobile
- **Lecture seule** : quand la session est `completed`, le relecteur peut consulter mais plus commenter
- **Confirmation commentaires non envoyés** : l'auteur et le relecteur voient une modale de confirmation s'ils tentent de quitter avec des brouillons non envoyés. Côté auteur, `useBlocker` (react-router) intercepte toute navigation in-app + `beforeunload` pour la fermeture d'onglet
- **Filtres de statut** : la liste des relectures (auteur) dispose de filtres par statut (en attente, en cours, terminée, clôturée)
- **Indicateur commentaires en attente** : la page d'accueil (HomePage) et la sidebar affichent un badge sur les livres/relectures ayant des commentaires en attente (les sessions clôturées sont exclues du décompte)
- **Confirmation de clôture** : le bouton « Clôturer » côté auteur demande confirmation via une modale
- **TicketBubble masquée** : la bulle de création de ticket est affichée uniquement sur la HomePage. La création de ticket est accessible via le menu « Aide & Support » dans la sidebar

### Releases

Système de gestion des versions de l'application :
- Statuts : `draft` → `planned` → `current` → `released`
- Les drafts ne sont visibles que par les admins
- Auto-demotion : quand une release passe en `current`, l'ancienne `current` devient `released`
- Chaque release a des items typés (`bugfix`, `improvement`, `feature`)
- Peut être liée à des tickets

---

## Persistance locale (`useBookStore` + `useLibraryStore`)

### Double sauvegarde

Le `useBookStore` sauvegarde toujours en **localStorage d'abord** (immédiat), puis en **cloud** (asynchrone) si l'utilisateur est authentifié :

```
saveBook() → localStorage.setItem(key, json)   ← toujours
           → api.books.save(bookId, data)       ← seulement si token JWT présent
```

### Clés localStorage (côté client, indépendant du mode dev/prod)

- `fabula-mea-library` — Bibliothèque (persist Zustand, contient les BookMeta[])
- `fabula-mea-book-{bookId}` — Données complètes d'un livre
- `emlb-token` — Token JWT (prod) ou token dev (dev)
- `emlb-last-seen-version` — Dernière version vue (pour badge "Nouveau" sur releases)
- `emlb-daily-snapshot:{bookId}` — Snapshot du total de mots/signes en début de journée (suivi progression journalière)

### Synchronisation cloud

Le store `useSyncStore` track l'état de sync : `disabled | idle | syncing | synced | error`.  
La sync est déclenchée à chaque `saveBook()` si un token est présent dans localStorage (`emlb-token`).

Au chargement d'un livre (`loadBook`), le store :
1. Charge depuis localStorage (immédiat)
2. Fetch depuis l'API en parallèle
3. Si la version cloud est plus récente → écrase le local

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
4. **Les serverless functions** sont en **CommonJS** (`module.exports`, pas `export default`). Le `tsconfig.json` dans `api/` gère ça. Les endpoints sont regroupés en **catch-all routes** (`[[...path]].ts`) pour respecter la limite de 12 fonctions du plan Hobby Vercel (9 fonctions actuellement). Voir `api/CLAUDE.md` pour le détail du routing interne.
5. **CORS** : chaque endpoint prod doit appeler `handleCors(req, res)` en premier.
6. **Auth** : chaque endpoint protégé doit appeler `requireAuth(req, res)` qui retourne `{ userId }` ou `null`.
7. **Le `useBookStore`** est le store le plus complexe (~965 lignes). Il gère tout le contenu d'un livre et auto-save en local + cloud.
8. **TipTap** est utilisé pour l'éditeur de scènes, les descriptions de tickets, les notes & idées (avec checklists via TaskList/TaskItem), et les commentaires. Les toolbars sont dans les composants editor. Les styles TaskList sont dans `index.css`. Extensions `@tiptap/extension-text-style`, `@tiptap/extension-font-family` et `src/lib/font-size-extension.ts` (custom) permettent de changer la police et la taille d'un texte sélectionné dans l'éditeur de scènes. Les titres h1/h2/h3 ont été retirés de la barre d'outils. Le collage de texte externe est nettoyé (suppression des styles inline via `transformPastedHTML`).
9. **La page relecteur** (`/review/:token`) est publique et accessible sans authentification. La `TicketBubble` et le `TicketForm` sont masqués pour les utilisateurs non connectés.
10. **Les sessions de relecture** figent un snapshot des chapitres/scènes au moment de la création. Les modifications ultérieures du livre n'affectent pas les relectures en cours.
11. **Les commentaires de relecture** ont un workflow draft → sent → closed. Le relecteur ET l'auteur créent des brouillons, les envoient explicitement (envoi groupé), et l'auteur peut résoudre les commentaires.
12. **Redirection post-login** : si un utilisateur non connecté tente d'accéder à une page (ex: lien email `reviews/{id}`), l'URL est sauvegardée dans `sessionStorage` (`emlb-redirect-after-login`) et l'utilisateur est redirigé après connexion.
13. **Emails** : en prod, les emails sont envoyés via Resend (`api/_lib/email.ts`). En dev, `devEmailLog()` dans `dev-db.ts` affiche les emails simulés dans la console du navigateur.
14. **TicketBubble** : affichée uniquement sur la HomePage (quand aucun livre n'est sélectionné). Dans les pages livre, la création de ticket se fait via le menu « Aide & Support » dans la sidebar.
15. **Sidebar** : la navigation livre commence par un lien top-level « Vue d'ensemble » (tableau de bord), puis des groupes dépliables — Encyclopédie (Personnages, Lieux, Cartes, Univers), Manuscrit (Chapitres, Chronologie, Avancement, Relectures), Notes & Idées, Paramètres, et Aide & Support (Créer un ticket avec style bouton, Tickets). L'expansion automatique suit la route active. La sélection d'un livre redirige vers `/encyclopedia` (tableau de bord).
16. **Timeline (filtrage doux)** : les filtres de la chronologie ne masquent plus les scènes non correspondantes, elles sont affichées avec une opacité réduite (`opacity-20`). L'axe temporel et les rangées restent stables.
17. **ImageUpload rond** : le composant `ImageUpload` supporte un mode `round` avec un bouton « Recadrer » pour entrer en mode crop (drag-to-pan vertical, `offsetY`) et un bouton « Valider » pour confirmer. Utilisé pour les avatars de personnages. Un composant `CharacterAvatar` (`src/components/characters/CharacterAvatar.tsx`) affiche l'avatar rond avec `imageOffsetY` en différentes tailles (8/10/12/16/32), utilisé dans CharacterDetail, CharacterCard et RelationshipGraph.
18. **Confirmation modifications non sauvegardées** : le formulaire de personnage (CharacterForm) affiche une modale à 3 boutons (Annuler/Quitter/Enregistrer) si l'utilisateur tente de fermer avec des modifications non sauvegardées.
19. **Mettre à jour ce fichier** : après toute modification du code (nouvelle fonctionnalité, changement d'architecture, nouveau type, nouvel endpoint…), vérifier si des informations de ce `CLAUDE.md` (et `api/CLAUDE.md`) doivent être mises à jour pour rester en phase avec le code (structure des fichiers, modèle de données, clés de stockage, points d'attention, etc.).
20. **Glossaire** : le glossaire est une fonctionnalité transversale activable par livre (`glossaryEnabled` dans `BookProject`). Les entités (Character, Place, WorldNote) ont un champ `inGlossary?: boolean`. Le glossaire est affiché dans : ChaptersPage (section collapsible après « Après l'histoire »), SceneEditor (entrée nav + section read-only en bas), relectures (nav + contenu via `snapshot.glossary`), et exports EPUB/PDF. **Le type de fiche n'est plus affiché dans le glossaire** (ni dans l'éditeur, ni dans les relectures, ni dans les exports). Un indicateur visuel (icône `BookText`) apparaît dans les listes et fiches des personnages, lieux et notes univers quand `inGlossary === true`.
21. **Création de relecture** : les scènes avec statut `outline` (plan) ou `draft` (brouillon) ne peuvent pas être sélectionnées. Le statut est affiché à côté de chaque scène.
22. **Changement de statut de scène** : peut se faire directement depuis la liste des scènes (ChaptersPage) via un select inline, sans avoir à ouvrir la fiche de modification.
23. **Couvertures et page de titre** : la 1ère de couverture et la page de titre (titre + auteur) apparaissent dans le manuscrit (ChaptersPage), les relectures (nav « Page de titre » + contenu), le PDF (avant la page de titre) et l'EPUB (métadonnées OPF `properties="cover-image"`). La 4ème de couverture apparaît à la fin dans le manuscrit, les relectures (nav « 4ème de couverture ») et le PDF. Dans l'EPUB, seule la 1ère de couverture est intégrée aux métadonnées. La tranche a été supprimée des paramètres.
24. **Table des matières** : activable via `tableOfContents` dans `BookProject` (checkbox tout en haut de la page ChaptersPage, avant « Avant l'histoire »). Apparaît dans PDF et EPUB uniquement. Les chapitres front/back matter sont éclatés en entrées individuelles par scène (seulement celles avec titre). Les numéros de page sont générés via CSS `target-counter()` dans le PDF.
25. **Images et CDN** : les images (avatars personnages, lieux, notes univers, cartes, couvertures) sont stockées sur **Vercel Blob** (CDN) en production et en **base64 dans localStorage** en développement. Le helper `src/lib/upload.ts` (`uploadImage()`) gère la logique : en dev → retourne le base64 tel quel, en prod → upload vers `/api/upload` → retourne l'URL CDN publique. La **migration lazy** dans `useBookStore.saveBook()` détecte les images base64 restantes et les upload automatiquement au CDN avant la sync cloud. Les champs `imageUrl` et `coverFront`/`coverBack` acceptent indifféremment un base64 ou une URL HTTP (rétrocompatibilité). L'export EPUB utilise `resolveImageData()` qui gère les deux formats (fetch URL ou parse base64). L'export PDF fonctionne nativement avec les URLs via `<img src="...">`. Variable d'environnement requise : `BLOB_READ_WRITE_TOKEN`.
