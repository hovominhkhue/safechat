# 07 — Tech Debt Register — SafeChat

## Dettes acceptées au démarrage

Chaque ligne = une simplification consciente faite au MVP, son coût
futur, et quand on prévoit de la rembourser.

| # | Dette | Pourquoi maintenant | Coût futur estimé | Plan de remboursement |
|---|---|---|---|---|
| D-01 | **OTP simulé** (code fixe 123456) | Pas de budget Twilio, démo offline | 1-2 j (intégrer Twilio + facturation) | V1.1, avant ouverture publique |
| D-02 | **Pas de HTTPS** en dev | Local, certificats lourds à gérer | 0,5 j (reverse proxy Caddy / Nginx) | Au déploiement prod |
| D-03 | **Pas de rate limiting** sur /auth/* | Surface faible en démo | 0,5 j (express-rate-limit) | V1.1 |
| D-04 | **Pas de soft delete** sur les collections | Simplifie le MVP, pas de cas légal | 2-3 j (champ deletedAt + filtres globaux) | V1.1 si besoin audit |
| D-05 | **Pas d'audit log** structuré | Pas critique pour démo, console suffit | 2 j (collection AuditLog + middleware) | Avant ouverture publique |
| D-06 | **Logs non structurés** (console.log) | Lisible en dev, suffit pour la soutenance | 1 j (Pino + format JSON + request ID) | Avant prod |
| D-07 | **Pas de tests automatisés** | Priorité features pour MVP démontrable | 3-5 j (Jest + supertest sur routes critiques) | À introduire dès la 1re régression |
| D-08 | **Pas de CI/CD** | Push manuel suffit en solo | 0,5 j (GitHub Actions : lint + test sur PR) | Avant que l'équipe s'agrandisse |
| D-09 | **MongoDB instance unique** (pas de réplica) | Suffisant pour MVP, demande de l'infra | 1 j (replica set, ou Mongo Atlas) | À la mise en prod |
| D-10 | **Pas de RGPD complet** (droit à l'effacement, mentions légales) | Hors scope MVP école | 2-3 j (route /me DELETE + soft anonymization) | Obligatoire avant ouverture publique en UE |
| D-11 | **Pas de modération côté contenu** (filtre mots / IA) | Hors scope MVP, focus signalement manuel | 2-4 j (intégration API modération) | V2 |
| D-12 | ~~Auth socket via JWT en query string~~ | ✅ RÉSOLU Étape 6.2 — auth via socket.handshake.auth.token | — | — |
| D-13 | **Pas de tests automatisés sur le frontend** | SPA vanilla sans framework, pas de runner configuré | 2-3 j (Playwright ou Cypress pour les flows critiques) | V1.1 |
| D-14 | **Tailwind via CDN** (marqué "not for production") | Aucun build step souhaité au MVP | 1 j (PostCSS + purge CSS, passer à un vrai build) | Avant ouverture publique |
| D-15 | **Pas de pagination côté frontend** (scroll infini manuel) | Implémentation rapide avec `before` cursor | 1-2 j (virtualisation liste, skeleton loaders) | V1.1 si > 500 messages |
| D-16 | **localStorage pour le JWT** | Simple, fonctionne sans back-end session | 1 j (httpOnly cookie via endpoint `/auth/session`) | Avant prod (XSS via localStorage) |
| D-17 | **Pas de reconnexion Socket.IO automatique gérée côté UI** | Socket.IO gère la reconnexion bas niveau, l'UI ne resync pas | 1 j (event `reconnect` → recharger historique depuis `lastMessageAt`) | V1.1 |
| D-18 | **Format sender non normalisé entre socket et API** | Contournement inline dans `onMessageNew` | 0,5 j (middleware socket qui enrichit `message:new` avec `sender.username`) | V1.1 |
| D-19 | **Pas d'endpoint de recherche de users** pour initier un DM | Le DM demande à connaître l'ID cible | 1-2 j (GET /users?search=username) | V1.1 |
| D-20 | **Report dupliqué accepté** (même user, même message) | E11000 géré en 409 mais aucune validation business préalable | 0,5 j (vérification avant insert) | V1.1 |

## Risques techniques identifiés (top 5)

| # | Risque | Catégorie | Probabilité | Impact | Parade |
|---|---|---|---|---|---|
| R-1 | OTP fixe trivial à deviner si quelqu'un trouve le repo public | Sécurité | Élevée | Critique en prod | OTP réel via SMS (D-01) avant prod, README qui crie "ne pas déployer tel quel" |
| R-2 | Brute force sur /auth/verify-otp | Sécurité | Moyenne | Élevé | Rate limiting (D-03) + lockout après N tentatives |
| R-3 | Perte de tous les messages si conteneur Mongo détruit | Disponibilité | Moyenne | Élevé | Volume nommé `mongo_data` + backups réguliers (script cron en V1.1) |
| R-4 | Saturation mémoire serveur si 1000+ sockets simultanés sur 1 process | Scalabilité | Faible (au MVP) | Moyen | Adapter Redis Socket.IO + scaling horizontal (D-12 + infra V2) |
| R-5 | Injection NoSQL via payload non validé (query operators) | Sécurité | Moyenne | Élevé | Toujours valider et caster les inputs (string vs object), `express-mongo-sanitize` |

## Dette subie identifiée (non assumée à l'origine)

À documenter au fil du projet — chaque fois qu'on découvre une dette
qui n'était pas dans le tableau ci-dessus, on l'ajoute ici plutôt que
de la laisser silencieuse.

| Date | Dette découverte | Origine | Décision |
|---|---|---|---|
| — | — | — | — |

## Routine de remboursement

À chaque fin de sprint / session de travail :
1. Relire ce registre
2. Cocher les dettes remboursées (déplacer en bas avec date de
   remboursement)
3. Ajouter les nouvelles dettes subies découvertes en cours de route
4. Reprioriser le plan de remboursement si nécessaire