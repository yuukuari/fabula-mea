---
paths:
  - "src/pages/review/**"
  - "src/pages/reviews/**"
  - "src/pages/ReviewsPage.tsx"
  - "src/components/reviews/**"
  - "src/store/useReviewStore.ts"
  - "src/lib/review-highlights.ts"
  - "api/reviews/**"
---

# Système de relecture

Permet à un auteur de partager des extraits avec des relecteurs externes (non-inscrits).

## Sessions

- L'auteur crée une session en sélectionnant des chapitres/scènes → **snapshot figé** (modifications ultérieures du livre n'affectent pas la relecture)
- Accès par **token UUID** → URL publique `/review/{token}` (pas d'auth)
- Multi-email : virgules → une session par relecteur
- Les scènes `outline`/`draft` ne peuvent pas être sélectionnées

## Statuts

`pending` → `in_progress` → `completed` → `closed`
- `pending` : écran d'accueil (saisie du nom)
- `in_progress` : relecture en cours
- `completed` : terminée (lecture seule pour le relecteur)
- `closed` : clôturée par l'auteur (écran dédié)

## Commentaires

Workflow : `draft` → `sent` → `closed`
- Le relecteur ET l'auteur créent des brouillons, les envoient explicitement (envoi groupé)
- Réponses threadées via `parentId`
- L'auteur peut résoudre les commentaires
- Confirmation si quitter avec brouillons non envoyés (`useBlocker` + `beforeunload`)

## Emails et notifications

| Événement | Email | Notification in-app |
|-----------|-------|-------------------|
| Création session | `sendReviewInviteEmail` | — |
| Relecteur envoie commentaires | `sendCommentsNotificationEmail` | `review_comments_sent` |
| Auteur envoie réponses | `sendAuthorRepliedEmail` | — |
| Relecteur termine | `sendReviewCompletedEmail` | `review_completed` |

## UI

- **Highlights** : texte commenté surligné via `injectHighlights` (`review-highlights.ts`)
- **Clic commentaire → scroll** vers le passage
- **Panneau collapsible** desktop, drawers mobile
- **Vue auteur plein écran** : `ReviewAuthorView` sous `RootLayout` (pas HomeShell)
- **Indicateurs** : badge commentaires en attente (HomePage + sidebar), indicateur amber brouillons auteur (`authorDraftCount`)
- **Filtres de statut** sur la liste auteur

## Page relecteur (`/review/:token`)

Page publique sans auth. `TicketBubble` et `TicketForm` masqués pour utilisateurs non connectés.
