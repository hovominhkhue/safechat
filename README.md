# 💬 SafeChat

[![CI](https://github.com/hovominhkhue/safechat/actions/workflows/ci.yml/badge.svg)](https://github.com/hovominhkhue/safechat/actions/workflows/ci.yml)

Messagerie temps réel orientée développeurs, avec authentification OTP, channels par thématique technique, conversations privées et modération intégrée.

Projet école — Master, livré comme MVP fonctionnel et démontrable.

---

## 🚀 Quick start

Trois commandes pour tout lancer (Docker Desktop requis) :

```bash
git clone https://github.com/hovominhkhue/safechat.git
cd safechat
docker compose up --build
```

Ouvre ensuite **http://localhost:3001/** dans ton navigateur.

> ⚠️ Au premier lancement, seed les 6 channels thématiques :
> ```bash
> docker exec safechat-backend node src/scripts/seedChannels.js
> ```

### Démo en 3 étapes

1. Connecte-toi avec un numéro de téléphone (n'importe lequel), OTP simulé : `123456`
2. Rejoins le channel **#BACKEND** dans la sidebar
3. Ouvre la même URL dans un second navigateur (fenêtre privée), connecte-toi avec un autre numéro, rejoins **#BACKEND** aussi, et discute en temps réel ✨

---

## ✨ Fonctionnalités

- **Authentification** : phone + OTP simulé + JWT (7 jours)
- **Channels publics** par thématique technique : IA, Backend, Frontend, DevOps, Études, Projets
- **Conversations privées** : DM 1-1 et groupes
- **Temps réel** via Socket.IO avec rooms par conversation
- **Historique paginé** par cursor (scroll infini)
- **Modération** : signalement de message, panneau Reports pour MOD/ADMIN, blocage avec auto-résolution

---

## 🏗 Architecture

```
┌─────────────┐         ┌──────────────────────────┐         ┌──────────────┐
│  Navigateur │ ◀────▶  │  Backend Express :3001   │ ◀────▶  │  MongoDB :27017
│  Vanilla JS │  HTTP   │  • REST API              │         │  (Docker)    │
│  Tailwind   │   +     │  • Socket.IO             │         │              │
│             │  WS     │  • Static frontend       │         │              │
└─────────────┘         └──────────────────────────┘         └──────────────┘
                                   ▲
                                   │
                       docker-compose up --build
```

Détails complets dans [`00-kickoff-pack/05-architecture.md`](./00-kickoff-pack/05-architecture.md).

---

## 🛠 Stack

| Couche | Techno |
|---|---|
| Backend | Node.js 20, Express, Mongoose |
| Base de données | MongoDB 7 |
| Temps réel | Socket.IO 4 |
| Auth | JWT (jsonwebtoken) + OTP simulé |
| Frontend | HTML + JavaScript vanilla + Tailwind via CDN |
| Conteneurisation | Docker + Docker Compose |

---

## 📁 Structure du projet

```
safechat/
├── backend/                    # API Node.js + Express + Socket.IO
│   ├── src/
│   │   ├── config/             # Connexion MongoDB
│   │   ├── controllers/        # auth, conversations, channels, reports, moderation, messages
│   │   ├── middleware/         # auth (JWT), requireRole
│   │   ├── models/             # User, Channel, Conversation, ConversationMember, Message, Report
│   │   ├── routes/             # Endpoints REST
│   │   ├── sockets/            # Handlers Socket.IO
│   │   ├── scripts/            # seedChannels.js
│   │   └── server.js           # Point d'entrée
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # SPA vanilla JS servie en static par Express
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── tests/                      # Tests d'intégration end-to-end (Node)
│   ├── test-auth.js
│   ├── test-conversations.js
│   ├── test-channels.js
│   ├── test-messaging.js
│   └── test-reports.js
├── 00-kickoff-pack/            # Documentation projet (8 livrables)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 💻 Développement local (sans Docker)

Si tu préfères développer en mode "hot reload" sans rebuild Docker :

```bash
# Démarre uniquement MongoDB dans Docker
docker compose up -d mongodb

# Dans un autre terminal : backend en mode dev
cd backend
cp ../.env.example .env       # adapter MONGODB_URI=mongodb://localhost:27017/safechat
npm install
npm run dev                    # node --watch src/server.js
```

Le frontend est servi automatiquement à `http://localhost:3001/`.

---

## 🧪 Tests

Tests d'intégration end-to-end (Node, avec `socket.io-client` et `fetch` natif) :

```bash
cd tests
npm install
node test-auth.js
node test-conversations.js
node test-channels.js
node test-messaging.js
node test-reports.js
```

Chaque test couvre une étape complète du projet (auth, conversations, channels, messagerie, modération).

---

## 📚 Documentation

L'intégralité de la doc projet vit dans [`00-kickoff-pack/`](./00-kickoff-pack/) :

| # | Document | Contenu |
|---|---|---|
| 01 | [Project Brief](./00-kickoff-pack/01-project-brief.md) | Problème, cible, contraintes |
| 02 | [Product Scope](./00-kickoff-pack/02-product-scope.md) | User stories, MoSCoW, MVP, IN/OUT |
| 03 | [Domain Model](./00-kickoff-pack/03-domain-model.md) | RBAC, règles métier, machines à états |
| 04 | [Database](./00-kickoff-pack/04-database.md) | ERD + dictionnaire de données |
| 05 | [Architecture](./00-kickoff-pack/05-architecture.md) | Composants, flux, sécurité |
| 06 | [ADRs](./00-kickoff-pack/06-adr/) | 4 décisions structurantes |
| 07 | [Tech Debt Register](./00-kickoff-pack/07-tech-debt-register.md) | Dettes assumées + plan |
| 08 | [Definition of Done](./00-kickoff-pack/08-definition-of-done.md) | Checklist + état de la livraison |

---

## ⚠️ Limitations connues (MVP)

Ce projet est un MVP école. Les dettes techniques assumées sont listées dans [`07-tech-debt-register.md`](./00-kickoff-pack/07-tech-debt-register.md). Les plus importantes :

- **OTP simulé** (code fixe `123456`) — à remplacer par un vrai SMS avant prod
- **Pas de HTTPS** en dev — à mettre derrière un reverse proxy en prod
- **Pas de rate limiting** sur `/auth/*` — à ajouter avant ouverture publique
- **Tailwind via CDN** au lieu d'un build PostCSS

---

## 👤 Auteur

**HO Vo Minh Khue**  
Projet école — Master 2026

---

## 📄 Licence

Projet à but pédagogique. Pas de licence open source attribuée pour le moment.