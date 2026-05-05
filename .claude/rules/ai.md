---
description: Module IA — façade, mesure d'usage, limites, providers, ajout de feature
paths:
  - src/lib/ai/**
  - api/ai/**
  - api/_lib/ai-*.ts
  - src/components/ai/**
  - src/pages/admin/AdminUserDetailPage.tsx
---

# Module IA — Fabula Mea

## Principe

Toutes les fonctionnalités IA passent par une **façade unique** côté client (`src/lib/ai`) et un endpoint serverless **catch-all** (`api/ai/[[...path]].ts`). Les clés providers ne quittent jamais le serveur. Chaque appel est mesuré et limité par utilisateur.

L'IA n'écrit jamais à la place de l'auteur — elle assiste (image, recherche, suggestions). Toute génération est présentée en preview avec accept/reject explicite.

## Architecture

```
src/lib/ai/
  index.ts            # Façade IS_DEV ? mock : aiFetch (/api/ai/*)
  features.ts         # AI_FEATURES + défauts + AI_IMAGE_STYLES
  character-image.ts  # Construction du prompt depuis Character
  dev-mock.ts         # Mock localStorage (placeholder DiceBear)

api/ai/[[...path]].ts # Routes : /usage, /character-image
api/_lib/
  ai-provider.ts      # Wrapper fal.ai (image)
  ai-usage.ts         # Quotas Redis (fenêtre glissante 7j)

api/admin/[[...path]].ts # /admin/users/:id, /admin/users/:id/ai-limits

src/components/ai/
  AiUsageRecap.tsx                # Panneau usage réutilisable
  GenerateCharacterImageModal.tsx # UI de génération
```

## Mesure d'usage (fenêtre glissante)

- Stockage Redis : `emlb:ai:usage:{userId}` = JSON `AiUsageEntry[]` (timestamps des générations).
- Période : **7 jours glissants**. Pas de date d'ancrage : on ne garde que les entrées dont `now - ts < 7j`. Le prochain crédit se libère à `oldest_ts + 7j`.
- Le décompte se fait **par feature** (`AiFeatureId`).
- `checkAndIncrementUsage()` purge + vérifie + incrémente. Si quota dépassé, throw `QUOTA_EXCEEDED` (HTTP 429).

> **Note race condition** : pas d'atomicité `WATCH/MULTI` (Upstash REST limité). Risque marginal de dépassement de 1 sur deux requêtes simultanées du même utilisateur — acceptable pour notre charge.

## Limites

- Défauts globaux dans `FEATURE_DEFAULTS` (`api/_lib/ai-usage.ts`) ET `AI_FEATURES[*].defaultLimit` (`src/lib/ai/features.ts`). **Doivent rester synchronisés.**
- Override par défaut Redis : `emlb:ai:limits:default` (JSON `AiLimits`). Modifie tous les utilisateurs sans override.
- Override par utilisateur : `emlb:ai:limits:user:{userId}` (JSON `AiLimits`). Édité depuis `/admin/users/:id`.
- Lecture effective = défauts globaux ⊕ override utilisateur.

## Providers

### fal.ai (image)

- Clé : `FAL_KEY` (env Vercel, jamais exposée).
- Modèle text-to-image par défaut : `fal-ai/flux/dev` (~5s, ~$0.025/image). Override via `FAL_IMAGE_MODEL` (ex. `fal-ai/flux/schnell` pour ~$0.003, `fal-ai/flux-pro` pour le top).
- **Mode "Image de référence" — pipeline 2-passes** : Flux Redux et img2img classiques copient l'identité du sujet, pas seulement le style (testé : "fillette 11 ans" en référence générait toujours une fillette même avec un prompt "homme 35 ans"). On utilise donc :
  1. **Vision LLM** (default `fal-ai/llavav15-13b`, override `FAL_VISION_MODEL`) qui extrait une description **du style uniquement** (médium, palette, lumière, ambiance — pas le sujet).
  2. **Text-to-image standard** avec le style injecté en texte dans le prompt.
  - 1 crédit `character_image` consommé (les 2 appels fal sont internes au flow). Coût ~+$0.001 pour la vision, négligeable.
  - En cas d'échec de la vision, on fallback sur le prompt original (best-effort).
- Modèle d'**affinage img2img** par défaut : `fal-ai/flux/dev/image-to-image` (`strength: 0.7`). Override via `FAL_IMG2IMG_MODEL`. Activé quand `iterateImageUrl` est fourni. **Mutuellement exclusif** avec `referenceImageUrl` (validation 400 sinon).
- **Modèle par style** (auto-routing dans `STYLE_DEFAULTS`) :
  - `realistic`, `cinematic` → `fal-ai/flux-pro/v1.1` (~$0.05/image, photoréalisme)
  - `painterly`, `anime`, `cartoon`, `sketch` → `fal-ai/flux/dev` (~$0.025, excellent en illustration)
  - `flux/dev` n'est pas tuné pour la photo — il dérive vers l'illustration. Le routing évite ce piège.
  - Override par style : `FAL_REALISTIC_MODEL`, `FAL_CINEMATIC_MODEL` (côté dev : `VITE_FAL_REALISTIC_MODEL`, `VITE_FAL_CINEMATIC_MODEL`).
  - Override global de fallback : `FAL_IMAGE_MODEL` (utilisé uniquement si aucun style n'est passé, cas marginal).
- **Style `realistic` est `visualOnly`** : `buildCharacterImagePrompt` exclut alors les indices narratifs (personnalité, traits, genre, synopsis) qui pullent vers l'illustration. Seuls la description physique, la profession et le texte libre subsistent.
- Endpoint sync `https://fal.run/{model}`. Retourne `{ images: [{ url, content_type, ... }] }`.
- Les URLs fal sont éphémères → après génération, on **re-uploade** vers Vercel Blob (`@vercel/blob`).
- En cas d'échec re-upload, on retombe sur l'URL fal (image potentiellement perdue à terme — log).

### Ajouter un autre provider

1. Nouveau fichier `api/_lib/<provider>.ts` avec une fonction wrapper typée.
2. Router via env var (ex. `IMAGE_PROVIDER=fal|replicate`).
3. La façade client (`ai.generateXxx`) reste inchangée.

## Ajouter une feature IA

1. **Type** → ajouter l'ID dans `AiFeatureId` (`src/types/index.ts`) **ET** dans `api/_lib/ai-usage.ts` (les types y sont redéclarés car `api/` est CommonJS isolé). Pareil pour `FEATURE_DEFAULTS` et `ALL_FEATURES`.
2. **Registre** → entrée dans `AI_FEATURES` (`src/lib/ai/features.ts`) avec `defaultLimit`.
3. **Endpoint** → handler dans `api/ai/[[...path]].ts` :
   - `requireAuth`
   - validation des inputs
   - `checkAndIncrementUsage(userId, feature)` AVANT l'appel provider
   - appel provider
   - retour `{ ..., usage }` (nouveau résumé)
4. **Mock dev** → méthode dans `aiDevMock` (`src/lib/ai/dev-mock.ts`).
5. **Façade** → méthode dans `ai` (`src/lib/ai/index.ts`).
6. **UI** → composant déclencheur (toujours preview + accept/reject, jamais d'écriture directe).

## En dev (`IS_DEV`)

- **Sans clé** : génération = **placeholder DiceBear** déterministe (seed = 3 premiers mots du prompt).
- **Avec clé** : si `VITE_FAL_KEY` est définie dans `.env.local`, le mock appelle fal.ai **directement depuis le navigateur**. Permet de tester l'IA réelle en `npm run dev` sans `vercel dev`. Override modèle via `VITE_FAL_IMAGE_MODEL` (défaut `fal-ai/flux/dev`).
  - ⚠️ La clé est exposée au bundle client en local. Acceptable pour `.env.local` non commité — **ne jamais** mettre `VITE_FAL_KEY` en env Vercel : la prod utilise `FAL_KEY` (sans préfixe `VITE_`) côté serveur.
  - Les usages restent comptés en localStorage en dev (pas de Redis).
- Usage stocké dans `localStorage` (`emlb-dev:ai:usage:{userId}`).
- Limites stockées dans `localStorage` (`emlb-dev:ai:limits:default`, `:user:{id}`).

## UI partagée

- **Recap utilisateur** : `<AiUsageRecap />`, dans `/profile` (onglet « Utilisation IA »).
- **Recap admin** : même composant, paramètré avec `initialSummary`, dans `/admin/users/:id`.
- **Bouton génération** : icône `lucide-react/Sparkles` (cohérent dans toute l'app).

## Points d'attention

1. **Toujours mesurer AVANT d'appeler le provider** — sinon le quota est ignoré et la facture explose.
2. **Ne pas exposer la clé provider côté client.** Tout passe par `/api/ai/*`.
3. **Synchroniser les défauts** entre `src/types` (`AI_FEATURES`) et `api/_lib/ai-usage.ts` (`FEATURE_DEFAULTS`) — pas de partage de types possible (CommonJS isolé).
4. **Image perso** : le prompt est construit côté client (`buildCharacterImagePrompt`) puis envoyé au serveur. Évite d'envoyer toute la fiche brute.
5. **Re-upload Blob** : pas optionnel à terme — les URLs fal expirent.
6. **Cohérence de style** (`character_image`) : la modale propose un mode « Image de référence » dès qu'au moins un autre personnage du livre a une `imageUrl`. Style preset et image de référence sont **mutuellement exclusifs**. En mode référence, `buildCharacterImagePrompt` omet le médium (« Photorealistic photograph of a... » → « Portrait of a... ») et les modificateurs de style ; le style provient de la description extraite par le vision LLM (cf. pipeline 2-passes ci-dessus).
7. **Itération vs nouvelle variation** : quand un aperçu est affiché, deux boutons distincts. **« Nouvelle variation »** = génération fraîche depuis le prompt (varie beaucoup). **« Affiner »** = img2img sur l'aperçu (garde identité/composition, applique les précisions complémentaires). Désactivé en mode « Image de référence » pour éviter les signaux contradictoires.
8. **Historique** : `Character.generatedImages: GeneratedCharacterImage[]` (max 10, plus ancienne supprimée). Chaque génération réussie est append en tête. Cliquer une vignette met en aperçu (sans coût). Les actions au survol : utiliser comme avatar / mettre en aperçu / supprimer. ⚠️ En dev sans re-upload Blob, les URLs fal expirent (~7-14j). En prod, l'URL pointe vers Vercel Blob — durable.
9. **Âge** : `buildCharacterImagePrompt` injecte l'âge à 3 endroits (lead, cues visuels par tranche, queue) car Flux ignore facilement un nombre isolé. Pour les âges hauts, des cues physiques explicites (rides, cheveux gris) compensent le biais du modèle vers les visages jeunes.
