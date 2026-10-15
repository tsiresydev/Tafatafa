# Base de données — Plateforme de Chat

## Vue d'ensemble

MongoDB (NoSQL) — proposé par le cahier des charges.

## Entités (logiques)

- User: nom, email, mot de passe (hashé), intérêts, photo, rôles.
- Message: expéditeur, destinataire, contenu, timestamp.
- Report: signalé par, signalé, raison, statut.
- Session/Match (optionnel): mise en relation aléatoire.

## Relations

- User 1..* Message
- User 1..* Report (auteur et cible)

## Contraintes

- Email unique.
- Mot de passe hashé (bcrypt — proposé).
- Validation des champs à l'entrée.

## Index

- Email unique.
- Timestamp pour messages.
- Intérêts/localisation pour filtres.

## Migration

Schéma flexible (NoSQL); versioning à prévoir si nécessaire.