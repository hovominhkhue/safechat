# 05 — Architecture — SafeChat

## 1. Schéma de composants

```
┌────────────────────────────────────────────────────────────────────┐
│                          UTILISATEUR                               │
│                       (navigateur web)                             │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
              HTTPS (prod) / HTTP (dev)
                           │
       ┌───────────────────┴───────────────────┐
       │            FRONTEND                    │
       │   Frontend MVP en vanilla JS + Tailwind CDN, servi │
       │   directement par le backend Express.  │
       │   Pas de build step, démarrage zéro config. │
       │   • Affiche channels et messages       │
       │   • Connecte au WebSocket              │
       │   • Stocke le JWT en localStorage     │
       └───────────────────┬───────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       REST (auth, reports)      WebSocket (Socket.IO)
              │                         │
              ▼                         ▼
       ┌────────────────────────────────────────┐
       │             BACKEND Node.js            │
       │             (port 3001)                │
       │   ┌──────────────────────────────┐     │
       │   │  Express (routes REST)       │     │
       │   │  • /auth/request-otp         │     │
       │   │  • /auth/verify-otp          │     │
       │   │  • /auth/me                  │     │
       │   │  • /reports                  │     │
       │   ├──────────────────────────────┤     │
       │   │  Socket.IO (temps réel)      │     │
       │   │  • conversation:join         │     │
       │   │  • message:send              │     │
       │   │  • message:new (broadcast)   │     │
       │   ├──────────────────────────────┤     │
       │   │  Middleware                  │     │
       │   │  • auth.js (vérif JWT)       │     │
       │   │  • cors                      │     │
       │   ├──────────────────────────────┤     │
       │   │  Controllers / Services      │     │
       │   │  • règles métier             │     │
       │   ├──────────────────────────────┤     │
       │   │  Models (Mongoose)           │     │
       │   │  • User, Channel,            │     │
       │   │    Conversation, Message,    │     │
       │   │    Report, ConversationMember│     │
       │   ├──────────────────────────────┤     │
       │   │  + express.static(./frontend)│     │
       │   │    → sert le frontend SPA    │     │
       │   └──────────────────────────────┘     │
       └────────────────────┬───────────────────┘
                            │
                     Driver MongoDB
                            │
                            ▼
              ┌─────────────────────────┐
              │  MongoDB 7 (Docker)     │
              │  port 27017             │
              │  volume mongo_data      │
              └─────────────────────────┘

       Orchestration : Docker Compose (un seul `docker compose up`)
```

## 2. Flux principaux

### Flux auth (OTP simulé + JWT)
1. Client → `POST /auth/request-otp` avec `{ phone }`
2. Backend crée le user si absent, répond `{ ok: true, message: "OTP envoyé (simulé: 123456)" }`
3. Client → `POST /auth/verify-otp` avec `{ phone, otp: "123456" }`
4. Backend vérifie OTP, génère JWT signé (HS256, expire 7j), répond `{ token, user }`
5. Client stocke le JWT, l'inclut en header `Authorization: Bearer <token>` sur les routes protégées
6. Client → `GET /auth/me` (header Authorization) → middleware vérifie JWT → controller renvoie le user courant

### Flux envoi message (WebSocket)
1. Client se connecte à Socket.IO avec son JWT (handshake `auth`)
2. Middleware socket vérifie le token, attache `socket.data.userId`
3. Client émet `conversation:join` → backend vérifie l'appartenance via `ConversationMember`
4. Client émet `message:send { conversationId, content }`
5. Backend valide l'appartenance, crée le `Message` en base (status SENT)
6. Backend met à jour le cache `Conversation.lastMessageAt / lastMessagePreview`
7. Backend broadcast `message:new` à la room `conversation:<id>` → tous les membres connectés reçoivent

### Flux modération (signalement et blocage)
1. Client (USER) → `POST /reports` avec `{ messageId, reason }` → crée le Report, met `Message.isReported = true`
2. MODERATOR → `GET /moderation/reports` → liste des messages signalés
3. MODERATOR → `PATCH /messages/:id/block` → passe le Message en status BLOCKED
4. Les sockets connectés reçoivent un event `message:blocked` pour masquer côté UI

## 3. Matrice des responsabilités

| Capacité | Responsable | Pas le rôle de |
|---|---|---|
| Validation des entrées (body, params) ✅ RÉALISÉ | Express endpoint + Mongoose schema | Le front (contournable) |
| Règles métier (RBAC, appartenance) | Controllers / middlewares | Triggers DB (Mongo n'en a pas vraiment) |
| Intégrité référentielle (refs ObjectId) | Mongoose validation + indexes uniques | Code applicatif seul |
| Permissions RBAC via JWT ✅ RÉALISÉ | Middleware `auth.js` + `requireRole.js` (lit JWT, attache `req.user`) | Front (affichage seulement) |
| Authentification | Route `/auth/*` + middleware JWT | URL guessing côté front |
| Diffusion temps réel via Socket.IO rooms ✅ RÉALISÉ | Socket.IO rooms (`conversation:<id>`) | HTTP polling |
| Authentification socket via JWT (auth.token) ✅ RÉALISÉ | Middleware socket `jwtAuthMiddleware` (socket.handshake.auth.token) | query string userId |
| Stockage des messages | MongoDB (collection messages) | Mémoire serveur (perdrait au restart) |
| Envoi OTP réel (SMS) | ⚠️ Hors scope MVP — simulé | — |

## 4. Sécurité by design

### Réflexes appliqués
- ✅ **JWT court à moyen terme** : 7 jours, signé HS256 avec `JWT_SECRET`
- ✅ **Secrets hors code** : `.env` listé dans `.gitignore`, `.env.example`
  versionné avec placeholders
- ✅ **Validation côté serveur** : tout body est revalidé en backend
  même si le front valide déjà
- ✅ **CORS configuré** explicitement (origine wildcard en dev,
  à restreindre en prod)
- ✅ **IDs opaques** : ObjectId Mongo, pas d'auto-increment exposé
- ✅ **bcryptjs installé** : prêt si on bascule en auth password (V2)

### Dette sécurité assumée (détail dans 07)
- ❌ **HTTPS** : non activé en dev. À mettre en prod via reverse proxy
  (Caddy / Nginx) ou plateforme managée
- ❌ **Rate limiting** : pas de protection brute-force sur `/auth/*`
  au MVP. À ajouter avant prod (express-rate-limit)
- ❌ **Audit log** : pas de trace structurée des actions sensibles
  (login, blocage, promotion de rôle)
- ❌ **RGPD** : `phone` est une donnée personnelle, pas de droit
  à l'effacement implémenté, pas de mentions légales

## 5. Observabilité minimale

| Pilier | État MVP | Cible V1.1 |
|---|---|---|
| **Logs** | `console.log` non structurés | Pino + format JSON, request ID |
| **Métriques** | aucune | Endpoint `/metrics` (prom-client) |
| **Traces** | aucune | Sentry pour les erreurs en prod |

Pour la démo de soutenance, le `console.log` suffit. Pour la prod réelle,
ces trois piliers sont à mettre en place avant ouverture publique.

## 6. Réservations pour la suite

### Docker
- ✅ MongoDB déjà conteneurisé (`mongo:7`, volume nommé)
- 🚧 `Dockerfile` backend à créer (à la fin de l'étape 1 du planning)
- 🚧 Service backend à ajouter dans `docker-compose.yml`
- 🚧 Service frontend à ajouter quand le SPA sera prêt

### CI/CD
- 🚧 GitHub Actions à mettre en place : lint + tests sur chaque PR
- 🚧 Branche `main` à protéger : pas de push direct, PR obligatoire

### Design patterns
- ✅ Séparation `routes / controllers / models` déjà appliquée
- 🚧 Couche `services/` à enrichir au fil de la complexité métier
  (actuellement la logique est dans les controllers)
- 🚧 Pattern Repository à introduire si on bascule un jour vers une
  autre BDD (peu probable en MVP)