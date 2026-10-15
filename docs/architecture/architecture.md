# Architecture — Plateforme de Chat

## Vue d'ensemble

Application web composée d'un frontend (HTML/CSS/JS, React ou Vue conseillé) et d'un backend (Node.js + Express), avec MongoDB. Déploiement Vercel/Render. Temps réel pour la messagerie.

## Style architectural (proposé)

Client-serveur avec API REST + WebSocket pour le temps réel. Séparation frontend/backend.

## Composants

- Frontend : UI, gestion d'état, appels API, WebSocket client.
- Backend : Express API, auth, gestion utilisateurs, matchmaking, modération, WebSocket server.
- Base de données : MongoDB (utilisateurs, messages, signalements).

## Organisation des modules

À définir selon la stack choisie (proposé: frontend src/components, pages; backend routes/controllers/services/models).

## Flux de données

Client ↔ API REST (auth, profils, filtres) + WebSocket (messages temps réel, A/V signaling).

## Intégrations externes

- MongoDB (persistance).
- Vercel/Render (hébergement).
- Service TURN/STUN pour WebRTC (A/V) — à valider.

## Gestion des erreurs

Codes HTTP standards, messages génériques côté client, logs côté serveur.

## Authentification / autorisation

JWT ou session — à valider. Rôles: utilisateur, modérateur/admin.

## Configuration et environnements

Variables via `.env` (port, DB URI, JWT secret). Voir `.env.example`.

## Décisions techniques validées / à valider

Validé : stack proposée par le cahier des charges (Node/Express/MongoDB/Vercel/Render).
À valider : frontend framework, WebSocket lib, auth mécanisme, stockage média.