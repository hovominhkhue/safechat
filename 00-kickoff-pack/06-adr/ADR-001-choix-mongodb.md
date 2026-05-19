# ADR-001 : Choix de MongoDB comme base de données principale

**Date :** 2026-05-15
**Statut :** Accepté
**Décideurs :** Équipe SafeChat (projet école Master)

## Contexte
SafeChat est une messagerie temps réel orientée développeurs. Volumétrie
attendue au MVP : quelques dizaines d'utilisateurs simultanés, ~1000 à
10 000 messages cumulés en démo. Modèle dominé par les écritures de
messages, et lectures par conversation (historique). Données semi-
structurées : un message peut évoluer (status, isReported, extensions
futures comme reactions, attachments).

## Options envisagées
1. **PostgreSQL 16** — relationnel mature, recommandé par défaut
2. **MongoDB 7** — NoSQL document, JSON natif
3. **Firestore** — managed BaaS Google

## Décision
MongoDB 7, conteneurisé via Docker Compose, accédé en Node.js via
Mongoose.

## Justification
- **Schéma évolutif** : les messages peuvent gagner des champs
  (reactions, attachments) sans migration lourde
- **Écriture intensive** : Mongo gère bien les inserts de messages
  en haute fréquence
- **Cohérence avec WebSocket** : payload natif JSON, pas de mapping
  ORM lourd entre socket et BDD
- **Mongoose** déjà connu par l'équipe → pas de surcoût d'apprentissage
- **Pas de jointure complexe** au MVP : conversations / membres /
  messages sont des accès simples par `conversationId`
- **Firestore exclu** : verrouillage cloud, coût difficile à prévoir,
  contraires aux objectifs école

## Conséquences

### Positives
- ✅ Démarrage rapide, schémas Mongoose lisibles
- ✅ Conteneurisation immédiate (image officielle `mongo:7`)
- ✅ Pas de migration SQL à gérer entre versions

### Négatives / risques
- ⚠️ Pas de jointure native : si on doit afficher "messages + nom du
  sender" en bulk, on dénormalise ou on fait deux requêtes
- ⚠️ Intégrité référentielle plus faible qu'en SQL : à compenser
  par des contrôles applicatifs
- ⚠️ Pas adapté si SafeChat évolue vers de l'analytics lourde
  (BigQuery / Postgres seraient mieux à ce moment-là)s