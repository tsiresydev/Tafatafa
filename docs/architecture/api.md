# API — Plateforme de Chat

## Vue d'ensemble

API REST + WebSocket (proposé) entre frontend et backend.

## Endpoints REST (proposés, à valider)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /auth/register | Inscription |
| POST | /auth/login | Connexion |
| GET | /users/me | Profil courant |
| PUT | /users/me | Modifier profil |
| GET | /users | Liste/filtre utilisateurs |
| POST | /reports | Signaler un abus |
| GET | /admin/reports | Liste signalements (modérateur) |

## WebSocket

- Connexion authentifiée.
- Événements : message envoyé/reçu, matchmaking aléatoire, appel A/V (signaling).

## Validation des données

Validation email, champs profil, messages non vides, etc.

## Authentification

JWT (proposé) — à valider.

## Codes HTTP et erreurs

200, 201, 400, 401, 403, 404, 500 avec messages génériques.

## Pagination / filtrage / tri

Filtres utilisateurs par intérêts/localisation; pagination à définir.