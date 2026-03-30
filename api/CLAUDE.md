# CLAUDE.md — API Serverless (Vercel Functions)

## Vue d'ensemble

Ce dossier contient les **serverless functions Vercel** qui forment le backend de l'application en production. En développement local (`npm run dev`), ces endpoints ne sont **jamais appelés** — le frontend utilise les mocks `src/lib/dev-db.ts` et `src/lib/dev-auth.ts` à la place.

> **Important** : ce dossier a son propre `package.json` avec `"type": "commonjs"`. Les fonctions sont compilées en CommonJS par Vercel.

---

## Variables d'environnement (Vercel)

| Variable | Usage |
|----------|-------|
| `JWT_SECRET` | Secret pour signer/vérifier les tokens JWT (30 jours d'expiration) |
| `UPSTASH_REDIS_REST_URL` | URL de l'instance Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Token d'accès Upstash Redis |

> ⚠️ Ces variables n'ont **PAS** le préfixe `VITE_` — elles sont côté serveur uniquement. Le fichier `src/lib/redis.ts` (côté client) utilise `VITE_UPSTASH_*` — c'est un résidu historique pour la sync directe.

---

## Utilitaires partagés (`_lib/`)

### `_lib/auth.ts`

```typescript
signToken(payload)     // Crée un JWT signé (30j)
verifyToken(token)     // Vérifie et décode un JWT
hashPassword(pwd)      // bcrypt hash (10 rounds)
comparePassword(pwd, hash) // bcrypt compare
getAuthUser(req)       // Extrait le user du Bearer token (retourne null si invalide)
requireAuth(req, res)  // Extrait le user OU répond 401 (retourne null si non auth)
```

**Pattern d'usage dans un endpoint :**
```typescript
const auth = requireAuth(req, res);
if (!auth) return; // la réponse 401 a déjà été envoyée
// auth.userId et auth.email sont disponibles
```

### `_lib/cors.ts`

```typescript
cors(req, res) // Ajoute les headers CORS + gère OPTIONS. Retourne true si preflight.
```

**Pattern d'usage :**
```typescript
if (cors(req, res)) return; // preflight → on s'arrête
```

### `_lib/redis.ts`

Client Upstash Redis REST minimaliste :
```typescript
redis.get(key)         // → string | null
redis.set(key, value)  // → void
redis.del(key)         // → void
```

Toutes les données sont stockées en JSON stringifié dans des clés Redis simples (pas de hashes, sets, etc.).

---

## Structure des clés Redis

| Clé | Contenu |
|-----|---------|
| `emlb:user:{id}` | JSON de l'utilisateur (id, email, name, passwordHash, isAdmin, createdAt) |
| `emlb:email:{email}` | Juste l'ID de l'utilisateur (index pour login) |
| `emlb:member-ids` | JSON Array des IDs de tous les membres (index pour admin) |
| `emlb:u:{userId}:library` | JSON Array des `BookMeta[]` de l'utilisateur |
| `emlb:u:{userId}:book:{bookId}` | JSON complet du `BookProject` |
| `emlb:tickets` | JSON Array de tous les `Ticket[]` |
| `emlb:ticket:{id}:comments` | JSON Array des `TicketComment[]` du ticket |
| `emlb:ticket:{id}:statusChanges` | JSON Array des `TicketStatusChange[]` du ticket |
| `emlb:releases` | JSON Array de toutes les `Release[]` |
| `emlb:review:{id}` | JSON d'une `ReviewSession` (accès par ID) |
| `emlb:review:token:{token}` | JSON d'une `ReviewSession` (accès par token public) |
| `emlb:u:{userId}:reviews` | JSON Array des IDs de sessions de relecture de l'auteur |
| `emlb:review:{id}:comments` | JSON Array des `ReviewComment[]` d'une session |

> **Toutes les listes sont stockées dans une seule clé Redis** (pas de listes Redis natives). Pour modifier un élément, on `GET` la liste, on modifie en mémoire, puis `SET` la liste entière. Ce pattern est simple mais ne scale pas pour des milliers d'éléments — c'est adapté à l'usage actuel (quelques dizaines d'items max).

---

## Endpoints

### Authentification

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/signup` | Non | Inscription (email, password, name) |
| POST | `/api/auth/login` | Non | Connexion (email, password) → token JWT |
| GET | `/api/auth/me` | Oui | Vérification du token → user info |

### Bibliothèque

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/library` | Oui | Récupère la bibliothèque de l'utilisateur |
| POST | `/api/library` | Oui | Sauvegarde la bibliothèque (Array de BookMeta) |

### Livres

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/book/{bookId}` | Oui | Récupère les données complètes d'un livre |
| POST | `/api/book/{bookId}` | Oui | Sauvegarde les données complètes d'un livre |
| DELETE | `/api/book/{bookId}` | Oui | Supprime un livre |

### Tickets

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/tickets` | Oui | Liste les tickets visibles (public + propres privés) |
| POST | `/api/tickets` | Oui | Crée un ticket |
| GET | `/api/tickets/{id}` | Oui | Détail d'un ticket + commentaires + statusChanges |
| PATCH | `/api/tickets/{id}` | Admin | Modifie le statut ou la release d'un ticket |
| DELETE | `/api/tickets/{id}` | Admin | Supprime un ticket |
| POST | `/api/tickets/{id}/comments` | Oui | Ajoute un commentaire |
| DELETE | `/api/tickets/{id}/comments/{commentId}` | Oui* | Supprime un commentaire |
| POST | `/api/tickets/{id}/comments/{commentId}/reaction` | Oui | Toggle une réaction emoji |

> *La suppression de commentaire vérifie que l'utilisateur est l'auteur ou admin.

### Releases

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/releases` | Non* | Liste les releases (drafts exclus pour non-admins) |
| POST | `/api/releases` | Admin | Crée une release |
| GET | `/api/releases/{id}` | Non | Détail d'une release |
| PATCH | `/api/releases/{id}` | Admin | Modifie une release |
| DELETE | `/api/releases/{id}` | Admin | Supprime une release |

> *Le GET ne nécessite pas d'auth mais filtre les drafts.

### Reviews — Côté auteur (auth requise)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/reviews` | Oui | Liste les sessions de l'auteur connecté |
| POST | `/api/reviews` | Oui | Crée une session (snapshot chapitres/scènes) |
| GET | `/api/reviews/{id}` | Oui | Détail session + commentaires |
| PATCH | `/api/reviews/{id}` | Oui | Change le statut (ex: `closed`) |
| DELETE | `/api/reviews/{id}` | Oui | Supprime une session |
| GET | `/api/reviews/{id}/comments` | Oui | Liste les commentaires |
| POST | `/api/reviews/{id}/comments` | Oui | Ajoute un commentaire auteur |
| PATCH | `/api/reviews/{id}/comments/{cid}` | Oui | Modifie un commentaire |
| DELETE | `/api/reviews/{id}/comments/{cid}` | Oui | Supprime un commentaire |

### Reviews — Côté relecteur (accès par token, pas d'auth)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/review/{token}` | Non | Récupère la session publique (snapshot + infos) |
| POST | `/api/review/{token}/start` | Non | Démarre la session (renseigne le nom) |
| POST | `/api/review/{token}/complete` | Non | Marque la session comme terminée |
| GET | `/api/review/{token}/comments` | Non | Liste les commentaires |
| POST | `/api/review/{token}/comments` | Non | Ajoute un commentaire relecteur |
| PATCH | `/api/review/{token}/comments/{cid}` | Non | Modifie un commentaire |
| DELETE | `/api/review/{token}/comments/{cid}` | Non | Supprime un commentaire |
| POST | `/api/review/{token}/send` | Non | Envoie les brouillons (draft → sent) |

### Admin

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/admin/members` | Admin | Liste tous les membres avec leur nombre de livres |

### Migration

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/migrate` | Oui | Migration bulk (library + books) |

---

## Comment créer un nouvel endpoint

### 1. Créer le fichier

```
api/mon-endpoint.ts           → /api/mon-endpoint
api/mon-endpoint/index.ts     → /api/mon-endpoint
api/mon-endpoint/[id].ts      → /api/mon-endpoint/{id}
api/mon-endpoint/[id]/sub.ts  → /api/mon-endpoint/{id}/sub
```

### 2. Structure type

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from './_lib/redis';       // ajuster le chemin relatif
import { requireAuth } from './_lib/auth';
import { cors } from './_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS (obligatoire)
  if (cors(req, res)) return;

  // 2. Auth (si nécessaire)
  const auth = requireAuth(req, res);
  if (!auth) return;

  // 3. Routing par méthode HTTP
  if (req.method === 'GET') {
    const data = await redis.get(`emlb:ma-cle:${auth.userId}`);
    return res.json(data ? JSON.parse(data) : []);
  }

  if (req.method === 'POST') {
    const body = req.body;
    await redis.set(`emlb:ma-cle:${auth.userId}`, JSON.stringify(body));
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
```

### 3. Ajouter le mock dev correspondant

Dans `src/lib/dev-db.ts`, ajouter les méthodes correspondantes avec stockage `localStorage` :
```typescript
monEndpoint: {
  async list(): Promise<MyType[]> {
    const raw = localStorage.getItem('emlb-dev:mon-endpoint');
    return raw ? JSON.parse(raw) : [];
  },
  async save(data: MyType[]): Promise<{ ok: boolean }> {
    localStorage.setItem('emlb-dev:mon-endpoint', JSON.stringify(data));
    return { ok: true };
  },
},
```

### 4. Ajouter dans la façade API

Dans `src/lib/api.ts` :
```typescript
monEndpoint: {
  list: () =>
    IS_DEV
      ? devDb.monEndpoint.list()
      : apiFetch<MyType[]>('/mon-endpoint'),
  save: (data: MyType[]) =>
    IS_DEV
      ? devDb.monEndpoint.save(data)
      : apiFetch<{ ok: boolean }>('/mon-endpoint', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
},
```

---

## Vérification admin

Pour vérifier si un utilisateur est admin, il faut charger son profil depuis Redis :

```typescript
async function isAdmin(userId: string): Promise<boolean> {
  const json = await redis.get(`emlb:user:${userId}`);
  if (!json) return false;
  const user = JSON.parse(json);
  return user.isAdmin === true;
}
```

Le champ `isAdmin` est stocké dans l'objet utilisateur dans Redis. Pour rendre un utilisateur admin, il faut modifier directement sa clé Redis `emlb:user:{id}`.

---

## Points d'attention

1. **CORS** : Toujours appeler `cors(req, res)` en premier dans chaque handler, même les endpoints publics.
2. **Méthode PATCH** : Pensez à l'ajouter dans les allowed methods de cors si nécessaire (actuellement `GET, POST, DELETE, OPTIONS`). Ça marche car le navigateur ne fait pas de preflight pour les PATCH simples.
3. **Paramètres dynamiques** : Accessibles via `req.query` — ex: `req.query.id` pour `[id].ts`. Toujours valider avec `typeof id === 'string'`.
4. **JSON dans Redis** : Toujours `JSON.stringify` avant `redis.set` et `JSON.parse` après `redis.get`.
5. **Pas de ORM** : Le client Redis est minimal (get/set/del). Toute la logique de filtrage, recherche, tri se fait en JavaScript après avoir chargé les données.
6. **Error handling** : Utiliser `try/catch` pour les opérations Redis. Retourner des erreurs JSON avec les bons codes HTTP.
7. **generateId()** : Chaque fichier qui en a besoin le redéfinit localement (pas de partage). Pattern : `Date.now().toString(36) + Math.random().toString(36).slice(2)`.
