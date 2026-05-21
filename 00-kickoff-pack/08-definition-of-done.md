# 08 — Definition of Done — SafeChat

Checklist du cadrage. Tant qu'elle n'est pas cochée à 100 %,
on ne commence pas (ou on ne continue pas) le développement
des features.

## Cadrage
- [x] `01-project-brief.md` rédigé, tient sur 1 page
- [x] Problème, cible, contexte et contraintes formalisés
- [x] Distinction explicite problème ≠ idée ≠ solution

## Périmètre
- [x] `02-product-scope.md` rédigé
- [x] User stories au format "En tant que / je veux / afin de"
- [x] Priorisation MoSCoW faite (Must < 60 % du backlog)
- [x] MVP défini par un critère observable
- [x] Liste IN / OUT explicite (avec raison d'exclusion)

## Modèle métier
- [x] `03-domain-model.md` rédigé
- [x] Rôles RBAC définis (USER / MODERATOR / ADMIN)
- [x] Règles métier numérotées (BR-01 à BR-15)
- [x] Machines à états dessinées pour les entités à statuts
      (Message : SENT → BLOCKED)
- [x] Cas d'erreur identifiés avec comportement attendu

## Base de données
- [x] `04-database.md` rédigé
- [x] Choix moteur justifié (MongoDB, voir ADR-001)
- [x] ERD lisible
- [x] Dictionnaire colonne par colonne, collection par collection
- [x] Timestamps sur tous les schemas (`{ timestamps: true }`)
- [x] Index prévus listés (notamment uniques et compound)
- [x] Anti-patterns évités et justifiés

## Architecture
- [x] `05-architecture.md` rédigé
- [x] Schéma de composants validé
- [x] Flux principaux décrits (auth, message temps réel, modération)
- [x] Matrice des responsabilités complète
- [x] 6 réflexes sécurité passés en revue (HTTPS, secrets, auth,
      validation, IDs opaques, bcrypt prêt)
- [x] Observabilité minimale prévue (au moins logs)
- [x] Place réservée pour Docker, CI/CD, design patterns

## ADR
- [x] `06-adr/ADR-001-choix-mongodb.md` rédigé
- [x] `06-adr/ADR-002-otp-simule.md` rédigé
- [x] `06-adr/ADR-003-websocket-socketio.md` rédigé
- [x] `06-adr/ADR-004-frontend-vanilla.md` rédigé
- [x] Chaque ADR : 1 page, contexte / options / décision /
      justification / conséquences

## Long terme
- [x] `07-tech-debt-register.md` rédigé
- [x] Dettes acceptées listées avec coût futur et plan de
      remboursement
- [x] Risques top 5 identifiés avec parade
- [x] Routine de remboursement définie

## Kickoff Pack final
- [x] Dossier `00-kickoff-pack/` créé à la racine du repo
- [x] Les 8 livrables présents et versionnés sur Git (branche
      `docs/kickoff-pack` ou directement `main`)
- [x] Relu par un pair ou par l'encadrant projet
- [x] Validé avant de passer à la phase de développement

---

## Signature

**Signé :** HO Vo Minh Khue  
**Date :** 20 / 05 / 2026  
**Pour SafeChat — projet école Master**

---

## Statut de remplissage des 8 livrables

| # | Document | Statut |
|---|---|---|
| 01 | project-brief.md | ✅ Complet |
| 02 | product-scope.md | ✅ Complet |
| 03 | domain-model.md | ✅ Complet |
| 04 | database.md | ✅ Complet |
| 05 | architecture.md | ✅ Complet |
| 06 | 4 ADRs dans 06-adr/ | ✅ Complet |
| 07 | tech-debt-register.md | ✅ Complet |
| 08 | definition-of-done.md | ✅ Complet (ce fichier) |

---

## État de la livraison MVP (au 2026-05-20)

Toutes les fonctionnalités de la DoD ont été livrées et validées
par des tests d'intégration scriptés (dossier `/tests`).

### DoD originale

- [x] `docker compose up --build` lance backend + mongo
- [x] Auth via OTP simulé + JWT
- [x] Création / adhésion à un channel
- [x] Chat temps réel entre 2 onglets
- [x] Persistance et reload de l'historique
- [x] DM entre 2 utilisateurs
- [x] Signalement persisté
- [x] Code sur Git, secrets non commités

### Livré en bonus (au-delà du strict MVP)

- [x] Modération complète : blocage de message + panneau reports MOD/ADMIN
- [x] Frontend SPA vanilla JS + Tailwind CDN servi par Express
- [x] Tests d'intégration end-to-end pour chaque étape (auth,
      conversations, channels, messaging, reports)

### Reste à livrer pour fermer le checkpoint complet

- [ ] README propre à la racine du repo (quickstart, captures, lien
      vers le Kickoff Pack)
- [ ] CI/CD GitHub Actions (lint + build, badge passing)
- [ ] Tests Jest unitaires (compléter les tests d'intégration
      scriptés)
