# 03 — Domain Model — SafeChat

## 1. Rôles et permissions (RBAC)

Trois rôles sur l'attribut `User.role` (enum).

| Capacité | USER | MODERATOR | ADMIN |
|---|---|---|---|
| S'authentifier (OTP + JWT) | ✅ | ✅ | ✅ |
| Voir / rejoindre les channels | ✅ | ✅ | ✅ |
| Envoyer un message dans une conv où il est membre | ✅ | ✅ | ✅ |
| Démarrer un DM avec un autre user | ✅ | ✅ | ✅ |
| Signaler un message (Report) | ✅ | ✅ | ✅ |
| Voir la liste des messages signalés | ❌ | ✅ | ✅ |
| Bloquer un message (status BLOCKED) | ❌ | ✅ | ✅ |
| Promouvoir un USER en MODERATOR | ❌ | ❌ | ✅ |
| Créer / éditer un Channel | ❌ | ❌ | ✅ |

Anti-pattern évité : pas de `isAdmin: boolean` sur User — un seul champ
`role` (enum) qui scale si on ajoute des rôles plus tard.

## 2. Règles métier (numérotées)

### Authentification
- BR-01 : `phone` est unique dans la collection users
- BR-02 : `username` est unique dans la collection users
- BR-03 : un utilisateur sans phone et sans username ne peut pas exister
- BR-04 : en MVP, l'OTP est simulé et vaut toujours `123456` (variable `OTP_FAKE_CODE`)
- BR-05 : un JWT est valide 7 jours (variable `JWT_EXPIRES_IN`)

### Conversations
- BR-06 : une conversation de type DM entre deux users A et B est
  unique (clé `dmKey` = sorted("A_B"))
- BR-07 : un channel public est unique par `topic` (IA / BACKEND /
  FRONTEND / DEVOPS / ETUDES / PROJETS)
- BR-08 : seuls les membres d'une conversation (entrée dans
  ConversationMember) peuvent y envoyer ou recevoir des messages
- BR-09 : un GROUP a un créateur (`createdBy`) qui devient OWNER
  automatiquement dans ConversationMember

### Messages
- BR-10 : un message a un `senderId` valide (user existant) et un
  `conversationId` valide
- BR-11 : un message bloqué (status = BLOCKED) n'est plus diffusé aux
  membres mais reste en base pour traçabilité
- BR-12 : `isReported = true` quand au moins un Report existe pour ce message

### Modération et reports
- BR-13 : un Report a obligatoirement `messageId`, `reportedBy`, `reason`
- BR-14 : un user ne peut pas signaler son propre message
- BR-15 : seul un MODERATOR ou ADMIN peut faire passer un message
  de SENT à BLOCKED

## 3. Machines à états

### Entité : Message
États : `SENT`, `BLOCKED`
création
↓
┌──────┐    block (MODERATOR/ADMIN)   ┌─────────┐
│ SENT │ ──────────────────────────→  │ BLOCKED │
└──────┘                              └─────────┘
Transitions autorisées :
- (création) → SENT (déclencheur : envoi via socket `message:send`)
- SENT → BLOCKED (déclencheur : action MODERATOR/ADMIN sur un message
  signalé)

Pas de retour BLOCKED → SENT en MVP (dette acceptée, voir doc 07).

### Entité : Conversation
Pas une vraie machine à états — uniquement un attribut `type` figé à
la création : `DM` | `GROUP` | `CHANNEL`. Une conversation ne change
jamais de type.

### Entité : ConversationMember
Attribut `role` figé à l'invitation : `OWNER` | `MEMBER`.
- OWNER attribué automatiquement à `createdBy` lors de la création
  d'un GROUP
- MEMBER pour tous les autres membres ajoutés

## 4. Cas d'erreur identifiés

| Cas | Comportement attendu |
|---|---|
| User envoie un message dans une conv où il n'est pas membre | 403 `NOT_A_MEMBER` côté socket |
| OTP invalide à la vérification | 401 `INVALID_OTP`, le user reste anonyme |
| Token JWT expiré ou invalide | 401, redirection vers la page de login |
| Deux users tentent de créer le même DM en parallèle | dmKey unique → la 2e création réutilise la conv existante |
| User signale deux fois le même message | Report dupliqué accepté en MVP (dette assumée, doc 07) |
| Message bloqué tenté de re-bloquer | Idempotent (pas d'erreur, statut inchangé) |