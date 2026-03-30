# CLAUDE.md — Écrire Mon Livre

## Vue d'ensemble

**Écrire Mon Livre** est une application web d'aide à l'écriture de livres. Elle permet de structurer un projet de roman : personnages, lieux, chapitres, scènes, worldbuilding, cartes, timeline, objectifs de progression, export EPUB/PDF. L'application inclut aussi un système de tickets (bug/amélioration/question), de releases, et un panneau d'administration.

L'application est une **SPA React** déployée sur **Vercel**, avec des serverless functions pour l'API et **Upstash Redis** pour la persistance en production. En développement local, tout fonctionne en **localStorage** sans aucun backend.

L'application inclut aussi un **système de relecture** permettant à un auteur de partager des chapitres/scènes avec des relecteurs externes (non-inscrits). Les relecteurs accèdent via un lien unique à une page publique (sans authentification) et peuvent commenter le texte en sélectionnant des passages.

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

### Mode production (Vercel)

- **Authentification** → `api/auth/*.ts` : vrais JWT signés avec `JWT_SECRET`, hashage bcrypt.
- **Base de données** → Upstash Redis via `api/_lib/redis.ts` (REST API).
- **Variables d'environnement requises** (configurées dans Vercel) :
  - `JWT_SECRET` — Secret pour signer les tokens JWT
  - `UPSTASH_REDIS_REST_URL` — URL de l'instance Upstash Redis
  - `UPSTASH_REDIS_REST_TOKEN` — Token d'accès Upstash Redis

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
├── api/                         ← Serverless functions (Vercel) — CommonJS
│   ├── CLAUDE.md                ← Doc spécifique API
│   ├── package.json             ← { "type": "commonjs" }
│   ├── _lib/                    ← Utilitaires partagés (auth, cors, redis)
│   ├── auth/                    ← signup, login, me
│   ├── book/                    ← CRUD livre par utilisateur
│   ├── tickets/                 ← CRUD tickets + commentaires + réactions
│   ├── releases/                ← CRUD releases
│   ├── admin/                   ← Endpoints admin (membres)
│   ├── review/                  ← Endpoints lecteur (accès par token, pas d'auth)
│   ├── reviews/                 ← Endpoints auteur (CRUD sessions + commentaires)
│   ├── library.ts               ← GET/POST bibliothèque utilisateur
│   └── migrate.ts               ← Migration de données
│
├── src/
│   ├── App.tsx                  ← Router + layouts (RootLayout → shells)
│   ├── main.tsx                 ← Point d'entrée React
│   ├── index.css                ← Tailwind directives + styles globaux
│   │
│   ├── types/
│   │   └── index.ts             ← Tous les types TypeScript (~309 lignes)
│   │
│   ├── lib/
│   │   ├── api.ts               ← ⭐ Façade API (IS_DEV ternaire)
│   │   ├── dev-auth.ts          ← Mock auth localStorage
│   │   ├── dev-db.ts            ← Mock DB localStorage
│   │   ├── redis.ts             ← Client Upstash côté client (sync directe)
│   │   ├── utils.ts             ← Helpers (generateId, now, CHAPTER_COLORS...)
│   │   ├── calculations.ts      ← Calculs progression (mots/jour, scènes/jour)
│   │   ├── export-epub.ts       ← Génération EPUB 3
│   │   ├── export-pdf.ts        ← Export PDF via window.print()
│   │   ├── migration.ts         ← Migration single-book → multi-book
│   │   └── spellcheck-extension.ts ← Extension TipTap correcteur
│   │
│   ├── store/
│   │   ├── useAuthStore.ts      ← Authentification (login/signup/logout)
│   │   ├── useLibraryStore.ts   ← Bibliothèque multi-livres (persist Zustand)
│   │   ├── useBookStore.ts      ← ⭐ Store principal (~794 lignes) : tout le contenu du livre
│   │   ├── useEditorStore.ts    ← État éditeur de scène (open/close/entrySceneId)
│   │   ├── useSyncStore.ts      ← Statut synchronisation cloud
│   │   ├── useTicketStore.ts    ← CRUD tickets + commentaires + réactions
│   │   ├── useReleaseStore.ts   ← CRUD releases
│   │   └── useReviewStore.ts    ← CRUD sessions de relecture + commentaires
│   │
│   ├── pages/                   ← Pages de l'application
│   │   ├── HomePage.tsx         ← Accueil / sélection de livre
│   │   ├── CharactersPage.tsx   ← Gestion personnages
│   │   ├── PlacesPage.tsx       ← Gestion lieux
│   │   ├── ChaptersPage.tsx     ← Chapitres + scènes + éditeur
│   │   ├── TimelinePage.tsx     ← Frise chronologique
│   │   ├── ProgressPage.tsx     ← Progression + objectifs + Pomodoro
│   │   ├── WorldPage.tsx        ← Notes de worldbuilding
│   │   ├── MapsPage.tsx         ← Cartes interactives
│   │   ├── SettingsPage.tsx     ← Paramètres + export + import
│   │   ├── TicketsPage.tsx      ← Tickets/feedback
│   │   ├── ReleaseNotesPage.tsx ← Notes de version
│   │   ├── ReviewsPage.tsx      ← Liste des sessions de relecture (auteur)
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
│       ├── characters/          ← Fiches personnages, relations, graphe
│       ├── maps/                ← Viewer de cartes, épingles
│       ├── progress/            ← Pomodoro, stats
│       ├── shared/              ← ConfirmDialog, EmptyState, ImageUpload, TagBadge
│       ├── tickets/             ← TicketBubble (conditionnel: masquée si non-logué), TicketForm
│       ├── releases/            ← NewReleaseModal, composants release
│       └── reviews/             ← NewReviewDialog, ReviewCommentPanel, ReviewContentViewer
```

---

## Modèle de données

### Entités d'un livre (`BookProject`)

Un livre contient :
- **Characters** — Personnages avec relations mutuelles, évolution, événements clés
- **Places** — Lieux typés (ville, bâtiment, paysage...) avec connexions
- **Chapters** — Chapitres ordonnés, contenant des scènes
- **Scenes** — Scènes avec statut (outline/draft/revision/complete), personnages, lieu, contenu TipTap
- **Tags** — Système d'étiquettes réutilisables
- **WorldNotes** — Notes de worldbuilding catégorisées
- **Maps** — Cartes avec épingles liées aux lieux
- **ProjectGoals** — Objectifs (date cible, mots/scène, périodes exclues)
- **WritingSessions** — Historique des sessions d'écriture

### Modes d'écriture (`WritingMode`)

- **`count`** — L'utilisateur renseigne manuellement le nombre de mots écrits par scène
- **`write`** — L'utilisateur écrit directement dans l'éditeur TipTap intégré (le comptage est automatique)

### Tickets

Les tickets sont globaux (pas liés à un livre). Système de feedback avec :
- Types : `bug`, `question`, `improvement`
- Visibilité : `public` (visible par tous) ou `private` (visible seulement par l'auteur et les admins)
- Statuts : `open`, `closed_done`, `closed_duplicate`
- Commentaires avec éditeur TipTap riche
- Réactions emoji
- Assignation optionnelle à une release
- Timeline d'activité (changements de statut, assignation release)

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
  - Statuts commentaire : `draft` (brouillon, non visible par l'auteur), `sent` (envoyé), `closed` (résolu par l'auteur)
  - Réponses (replies) : threaded via `parentId`
  - L'auteur peut répondre et résoudre les commentaires
- **Highlights** : le texte commenté est surligné dans le contenu (via `injectHighlights` dans `src/lib/review-highlights.ts`)
- **Clic commentaire → scroll** : cliquer sur un commentaire scrolle vers le passage surligné dans le contenu
- **Panneau collapsible** : le plan (nav) et les commentaires sont collapsibles sur desktop, drawers sur mobile
- **Lecture seule** : quand la session est `completed`, le relecteur peut consulter mais plus commenter
- **TicketBubble masquée** : la bulle de création de ticket n'est pas affichée pour les utilisateurs non connectés (relecteurs)

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

- `ecrire-mon-livre-library` — Bibliothèque (persist Zustand, contient les BookMeta[])
- `ecrire-mon-livre-book-{bookId}` — Données complètes d'un livre
- `emlb-token` — Token JWT (prod) ou token dev (dev)
- `emlb-last-seen-version` — Dernière version vue (pour badge "Nouveau" sur releases)

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
4. **Les serverless functions** sont en **CommonJS** (`module.exports`, pas `export default`). Le `tsconfig.json` dans `api/` gère ça.
5. **CORS** : chaque endpoint prod doit appeler `handleCors(req, res)` en premier.
6. **Auth** : chaque endpoint protégé doit appeler `requireAuth(req, res)` qui retourne `{ userId }` ou `null`.
7. **Le `useBookStore`** est le store le plus complexe (~794 lignes). Il gère tout le contenu d'un livre et auto-save en local + cloud.
8. **TipTap** est utilisé pour l'éditeur de scènes, les descriptions de tickets, et les commentaires. Les toolbars sont dans les composants editor.
9. **La page relecteur** (`/review/:token`) est publique et accessible sans authentification. La `TicketBubble` et le `TicketForm` sont masqués pour les utilisateurs non connectés.
10. **Les sessions de relecture** figent un snapshot des chapitres/scènes au moment de la création. Les modifications ultérieures du livre n'affectent pas les relectures en cours.
11. **Les commentaires de relecture** ont un workflow draft → sent → closed. Le relecteur crée des brouillons, les envoie explicitement, puis l'auteur peut les résoudre.
12. **Mettre à jour ce fichier** : après toute modification du code (nouvelle fonctionnalité, changement d'architecture, nouveau type, nouvel endpoint…), vérifier si des informations de ce `CLAUDE.md` (et `api/CLAUDE.md`) doivent être mises à jour pour rester en phase avec le code (structure des fichiers, modèle de données, clés de stockage, points d'attention, etc.).
