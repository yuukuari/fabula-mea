---
paths:
  - "src/store/useNotificationStore.ts"
  - "src/components/notifications/**"
  - "src/hooks/useNotificationPolling.ts"
  - "src/lib/push.ts"
  - "public/sw.js"
  - "api/notifications/**"
  - "api/_lib/notifications.ts"
---

# Système de notifications

## Architecture

Deux collections :
- **AppNotification** — liste globale (max 200), partagée entre tous les utilisateurs (type, acteur, message templaté, lien, payload, recipientIds)
- **Statut lu/non-lu** — par utilisateur, liste d'IDs lus

## Types

- `ticket_comment` — commentaire ticket → notifie créateur + commentateurs précédents
- `review_comments_sent` — relecteur envoie commentaires → notifie l'auteur
- `review_completed` — relecteur termine → notifie l'auteur

## Messages templatés

Templates à moustaches : `{{actorName}} a commenté le ticket « {{ticketTitle}} »`. Variables : `actorName` + clés de `payload`. Résolu via `resolveTemplate()` (`utils.ts`).

## UI

- **Cloche** : `Bell` dans les deux sidebars + barres mobiles. Badge compteur.
- **Modal** : dropdown positionné en fixed (via `getBoundingClientRect`). Actions : « Tout lire », « Marquer comme lu ».
- **Badges sidebar** : menu Tickets = total non lus `ticket_comment`. Chaque ticket = son propre badge.
- **Auto-mark** : TicketDetail → `markReadByPayload`

## Polling

`useNotificationPolling` : charge au montage + toutes les 60s. Nouvelles notifications → `showLocalNotification()`.

## Push navigateur

- **Opt-in** : `PushOptInModal` aux moments clés (page Tickets, après création relecture). Réapparaît après 7 jours (`emlb-push-optin-dismissed`).
- **Dev** : API `Notification` locale au polling
- **Prod** : Web Push via `web-push`. `createNotification()` (`api/_lib/notifications.ts`) envoie automatiquement. Subscriptions expirées (410) nettoyées. Service worker `public/sw.js`.
- **Variables** : `VITE_VAPID_PUBLIC_KEY` (client+serveur), `VAPID_PRIVATE_KEY` (serveur). Génération : `npx web-push generate-vapid-keys`.

## Ajouter un nouveau type

1. Ajouter le type à `NotificationType`
2. Appeler `createNotification` côté dev-db et serverless avec message templaté `{{var}}`
3. Optionnellement ajouter une icône dans `NotificationModal.TYPE_ICONS`
