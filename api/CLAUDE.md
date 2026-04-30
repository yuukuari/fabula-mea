# CLAUDE.md — API Serverless (Vercel Functions)

Ce dossier contient les **serverless functions Vercel** (backend production). En dev local, ces endpoints ne sont **jamais appelés** — le frontend utilise `src/lib/dev-db.ts` et `src/lib/dev-auth.ts`.

> **Important** : ce dossier a son propre `package.json` avec `"type": "commonjs"`.

## Variables d'environnement

| Variable | Usage |
|----------|-------|
| `JWT_SECRET` | Secret JWT (30 jours d'expiration) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Accès Upstash Redis |
| `RESEND_API_KEY` | Emails via Resend |
| `BLOB_READ_WRITE_TOKEN` | Upload images Vercel Blob |
| `TURNSTILE_SECRET_KEY` | (optionnel) CAPTCHA inscription |
| `VITE_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | (optionnel) Web Push |

> Pas de préfixe `VITE_` côté serveur (sauf `VITE_VAPID_PUBLIC_KEY` partagé avec le client).

## Utilitaires (`_lib/`)

```typescript
// auth.ts
requireAuth(req, res)  // → { userId, email } ou null (401 déjà envoyé)
signToken(payload)     // JWT 30j
hashPassword / comparePassword  // bcrypt

// cors.ts
cors(req, res)  // Headers CORS + gère OPTIONS. Retourne true si preflight.

// redis.ts
redis.get(key) / redis.set(key, value) / redis.del(key)  // REST minimaliste

// email.ts — Resend (silencieux si RESEND_API_KEY absent)
sendReviewInviteEmail / sendCommentsNotificationEmail / sendReviewCompletedEmail
sendTicketCreatedEmail / sendAuthorRepliedEmail / sendPasswordResetEmail
```

## Clés Redis

Pattern : `emlb:{domaine}:{id}`. Toutes les listes sont stockées en JSON dans une seule clé (GET → parse → modify → SET).

Clés principales : `emlb:user:{id}`, `emlb:email:{email}`, `emlb:member-ids`, `emlb:u:{userId}:library`, `emlb:u:{userId}:book:{bookId}`, `emlb:tickets`, `emlb:releases`, `emlb:review:{id}`, `emlb:saga:{sagaId}`, `emlb:notifications`.

## Architecture catch-all

Limite **12 fonctions** Vercel Hobby (11 actuellement). Endpoints regroupés en catch-all routes `[[...path]].ts`.

```
api/auth/[[...path]].ts       → login, signup, me, profile, change-password, account, forgot/reset-password
api/tickets/[[...path]].ts    → CRUD tickets + commentaires + réactions
api/releases/[[...path]].ts   → CRUD releases
api/reviews/[[...path]].ts    → auteur (auth) + relecteur /reader/ (public, même fichier)
api/notifications/[[...path]].ts → list, markRead, markAll, markByPayload, push sub/unsub
api/book/[bookId].ts          → GET/POST/DELETE livre
api/saga/[sagaId].ts          → GET/POST/DELETE saga
api/library.ts / upload.ts / migrate.ts / admin/members.ts
```

### Routing interne

```typescript
const pathSegments = getPathSegments(req, '/api/tickets');
// /api/tickets         → []
// /api/tickets/123     → ['123']
// /api/tickets/123/comments → ['123', 'comments']
```

> Les routes relecteur (`/api/reviews/reader/...`) n'appellent PAS `requireAuth` — le routeur vérifie `pathSegments[0] === 'reader'` en amont.

## Ajouter un endpoint

### Dans un catch-all existant
Étendre le switch/if de routing du fichier correspondant.

### Nouveau fichier
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from './_lib/redis';
import { requireAuth } from './_lib/auth';
import { cors } from './_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    const data = await redis.get(`emlb:ma-cle:${auth.userId}`);
    return res.json(data ? JSON.parse(data) : []);
  }
  if (req.method === 'POST') {
    await redis.set(`emlb:ma-cle:${auth.userId}`, JSON.stringify(req.body));
    return res.json({ ok: true });
  }
  return res.status(405).end();
}
```

Puis ajouter le mock dans `dev-db.ts` et la méthode dans `api.ts` (ternaire `IS_DEV`).

## Points d'attention

1. **CORS** : toujours `cors(req, res)` en premier, même endpoints publics
2. **Paramètres dynamiques** : `req.query.id` — valider avec `typeof id === 'string'`
3. **JSON Redis** : toujours `JSON.stringify`/`JSON.parse`
4. **Pas d'ORM** : filtrage/tri en JavaScript après chargement
5. **`generateId()`** : redéfini localement dans chaque fichier (pas de partage)
6. **Admin** : charger le profil Redis et vérifier `user.isAdmin === true`
