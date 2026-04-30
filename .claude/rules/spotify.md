---
paths:
  - "src/lib/spotify.ts"
  - "src/hooks/useSpotifyPlayer.ts"
  - "src/components/progress/FloatingSpotifyPlayer.tsx"
  - "src/pages/SpotifyCallbackPage.tsx"
---

# Lecteur Spotify intégré

Bouton flottant dans `AppShell` pour écouter des playlists pendant l'écriture. Requiert **Spotify Premium**.

## Accès contrôlé

Spotify est en mode développeur (limité à 25 utilisateurs). Champ `user.spotifyEnabled?: boolean` (défaut `false`), toggle par admin dans `AdminMembersPage`. `FloatingSpotifyPlayer` rendu uniquement si `spotifyEnabled === true`.

## Architecture

- `src/lib/spotify.ts` — OAuth PKCE, API playlists, persistance tokens
- `src/hooks/useSpotifyPlayer.ts` — Web Playback SDK, device discovery
- `src/components/progress/FloatingSpotifyPlayer.tsx` — UI panneau + bulle
- `src/pages/SpotifyCallbackPage.tsx` — popup OAuth

## Endpoints

- `PATCH /api/admin/members` — toggle `spotifyEnabled` (admin requis)
- `devAuth.setSpotifyEnabled()` en dev
- `spotifyEnabled` retourné par `/api/auth/login`, `/signup`, `/me`, `/profile`

## Particularités techniques

1. **OAuth PKCE sans client secret** — `code_verifier` stocké en `localStorage` (pas `sessionStorage`) car la popup ne partage pas le sessionStorage
2. **localhost interdit** — Spotify interdit `localhost` depuis avril 2025. Remplacement auto → `127.0.0.1`, `vite.config.ts` utilise `host: true`, `main.tsx` redirige `localhost` → `127.0.0.1`
3. **device_id** — le SDK et l'API REST ne retournent pas le même ID. Le hook requête `GET /me/player/devices` pour trouver le vrai par nom
4. **Retry play** — 5 tentatives, 1s d'intervalle (backend Spotify lent à enregistrer un device)

**Variable** : `VITE_SPOTIFY_CLIENT_ID`
