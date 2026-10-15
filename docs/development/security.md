# Security — Plateforme de Chat

## Secrets

- JWT secret, DB URI uniquement côté serveur, via `.env` (non committé).

## Authentification / autorisation

- Auth par email/mot de passe (hash bcrypt — proposé).
- Rôles utilisateur/modérateur.

## Validation des entrées

- Validation stricte côté serveur (email, messages, profil).

## Vulnérabilités

- Protection XSS, CSRF (si sessions), injection (params sanitizados).
- Rate limiting pour abus.
- HTTPS en production.

## Signalement / modération

- Journalisation des signalements.
- Pas de fuite d'informations sensibles dans les erreurs.

## Dépendances

- Audit de sécurité des dépendances (npm audit).