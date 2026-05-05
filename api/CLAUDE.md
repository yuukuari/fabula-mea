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
| `FAL_KEY` | Clé fal.ai pour la génération d'image (module IA) |
| `FAL_IMAGE_MODEL` | (optionnel) Fallback text-to-image — défaut `fal-ai/flux/dev`. Utilisé seulement si aucun style n'est fourni (cas marginal — chaque style a son défaut dédié). |
| `FAL_REALISTIC_MODEL` | (optionnel) Modèle pour le style `realistic` — défaut `fal-ai/flux-pro/v1.1` (photoréalisme) |
| `FAL_CINEMATIC_MODEL` | (optionnel) Modèle pour le style `cinematic` — défaut `fal-ai/flux-pro/v1.1` |
| `FAL_IMG2IMG_MODEL` | (optionnel) Modèle d'affinage img2img — défaut `fal-ai/flux/dev/image-to-image` (`strength: 0.7`) |
| `FAL_VISION_MODEL` | (optionnel) Vision LLM pour l'extraction de style depuis une image de référence — défaut `fal-ai/llavav15-13b`. Si l'endpoint n'est pas reconnu en prod, override avec un modèle vision valide ; le code fallback sur le prompt original si l'appel échoue. |

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

Clés principales : `emlb:user:{id}`, `emlb:email:{email}`, `emlb:member-ids`, `emlb:u:{userId}:library`, `emlb:u:{userId}:book:{bookId}`, `emlb:tickets`, `emlb:releases`, `emlb:review:{id}`, `emlb:saga:{sagaId}`, `emlb:notifications`, `emlb:ai:usage:{userId}`, `emlb:ai:limits:default`, `emlb:ai:limits:user:{userId}`.

## Architecture catch-all

Limite **12 fonctions** Vercel Hobby (12 actuellement — limite atteinte, regrouper en catch-all avant d'en ajouter). Endpoints regroupés en catch-all routes `[[...path]].ts`.

### Timeout des fonctions

Par défaut Vercel Hobby plafonne à 10s. `api/ai/[[...path]].ts` est étendu à **30s** dans `vercel.json` (`functions.maxDuration`) car le pipeline 2-passes (vision LLM + génération + re-upload Blob) peut dépasser 10s, surtout avec `flux-pro/v1.1` pour le photoréalisme. Si tu ajoutes d'autres fonctions IA, prévoir le même override.

```
api/auth/[[...path]].ts       → login, signup, me, profile, change-password, account, forgot/reset-password
api/tickets/[[...path]].ts    → CRUD tickets + commentaires + réactions
api/releases/[[...path]].ts   → CRUD releases
api/reviews/[[...path]].ts    → auteur (auth) + relecteur /reader/ (public, même fichier)
api/notifications/[[...path]].ts → list, markRead, markAll, markByPayload, push sub/unsub
api/admin/[[...path]].ts      → /members (GET/PATCH spotify), /users/:id (GET détail), /users/:id/ai-limits (PUT)
api/ai/[[...path]].ts         → /usage (GET), /character-image (POST) — voir .claude/rules/ai.md
api/book/[bookId].ts          → GET/POST/DELETE livre
api/saga/[sagaId].ts          → GET/POST/DELETE saga
api/library.ts / upload.ts / migrate.ts
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
7. **Quota IA** : `checkAndIncrementUsage(userId, feature)` doit être appelé **avant** l'appel provider — sinon une génération réussie ne décompte pas, ou pire, on appelle le provider sans vérifier le quota. En cas d'échec après décompte (provider down, blob failure), on n'annule pas — la fenêtre 7j absorbe et c'est documenté dans `.claude/rules/ai.md`.
8. **Sync types/defaults IA** : `AiFeatureId` et les défauts (`character_image: 5`) sont **dupliqués** entre `src/types/index.ts` (+ `src/lib/ai/features.ts`) et `api/_lib/ai-usage.ts`. Toute modification doit toucher les deux côtés (api/ a son propre tsconfig CommonJS, pas de partage de types possible).
