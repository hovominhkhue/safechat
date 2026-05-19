# 04 — Database — SafeChat

## 1. Choix moteur

- **Type :** MongoDB 7 (NoSQL document)
- **ODM :** Mongoose
- **Hébergement dev :** conteneur Docker `mongo:7` local
- **Justification :** voir `06-adr/ADR-001-choix-mongodb.md`

## 2. ERD (entités et relations)

```
┌────────────────────┐         ┌─────────────────────┐
│       User         │         │      Channel        │
├────────────────────┤         ├─────────────────────┤
│ _id (ObjectId) PK  │         │ _id (ObjectId) PK   │
│ phone (unique)     │         │ topic (unique)      │
│ username (unique)  │         │ name                │
│ role (enum)        │         │ description         │
│ timestamps         │         │ timestamps          │
└────────────────────┘         └─────────────────────┘
          │ 1                            │ 1
          │                              │
          │ N (createdBy)                │ N (channelTopic)
          │                              │
          ▼                              ▼
          ┌──────────────────────────────────┐
          │          Conversation            │
          ├──────────────────────────────────┤
          │ _id (ObjectId) PK                │
          │ type (DM | GROUP | CHANNEL)      │
          │ name                             │
          │ channelTopic (ref Channel.topic) │
          │ dmKey (unique sparse)            │
          │ createdBy (ref User)             │
          │ lastMessageAt                    │
          │ lastMessagePreview               │
          │ messageCount                     │
          │ timestamps                       │
          └──────────────────────────────────┘
                       │ 1
            ┌──────────┴──────────┐
            │ N                   │ N
            ▼                     ▼
  ┌──────────────────────┐   ┌────────────────────────┐
  │ ConversationMember   │   │       Message          │
  ├──────────────────────┤   ├────────────────────────┤
  │ _id (ObjectId) PK    │   │ _id (ObjectId) PK      │
  │ conversationId FK    │   │ conversationId FK      │
  │ userId FK            │   │ senderId FK → User     │
  │ role (OWNER|MEMBER)  │   │ content                │
  │ timestamps           │   │ contentType (TEXT)     │
  └──────────────────────┘   │ status (SENT|BLOCKED)  │
                             │ isReported             │
                             │ timestamps             │
                             └────────────────────────┘
                                      │ 1
                                      │
                                      │ N
                                      ▼
                             ┌────────────────────────┐
                             │        Report          │
                             ├────────────────────────┤
                             │ _id (ObjectId) PK      │
                             │ messageId FK → Message │
                             │ reportedBy FK → User   │
                             │ reason                 │
                             │ timestamps             │
                             └────────────────────────┘
```

## 3. Dictionnaire de données

### Collection : users
| Champ      | Type     | Contraintes              | Description |
|------------|----------|--------------------------|-------------|
| _id        | ObjectId | PK auto                  | Identifiant |
| phone      | String   | unique, sparse           | Numéro de tel, support OTP |
| username   | String   | unique, required         | Pseudo affiché |
| role       | String   | enum, default USER       | USER \| MODERATOR \| ADMIN |
| createdAt  | Date     | auto (timestamps)        | Création |
| updatedAt  | Date     | auto (timestamps)        | Dernière modification |

### Collection : channels
| Champ        | Type     | Contraintes        | Description |
|--------------|----------|--------------------|-------------|
| _id          | ObjectId | PK auto            | Identifiant |
| topic        | String   | enum, unique, required | IA \| BACKEND \| FRONTEND \| DEVOPS \| ETUDES \| PROJETS |
| name         | String   | required           | Nom affiché ("Backend & API") |
| description  | String   | optional           | Description longue |
| createdAt    | Date     | auto               | Création |
| updatedAt    | Date     | auto               | Modification |

### Collection : conversations
| Champ                | Type     | Contraintes      | Description |
|----------------------|----------|------------------|-------------|
| _id                  | ObjectId | PK auto          | Identifiant |
| type                 | String   | enum, required   | DM \| GROUP \| CHANNEL |
| name                 | String   | required pour GROUP/CHANNEL | Nom affiché |
| channelTopic         | String   | optional         | Lien vers Channel.topic si type=CHANNEL |
| dmKey                | String   | unique sparse    | Clé "userA_userB" triée, type DM uniquement |
| createdBy            | ObjectId | ref User         | Créateur de la conv |
| lastMessageAt        | Date     | optional         | Cache du dernier message |
| lastMessagePreview   | String   | ≤ 80 chars       | Aperçu du dernier message |
| messageCount         | Number   | default 0        | Compteur de messages |
| createdAt / updatedAt| Date     | auto             | Timestamps |

### Collection : conversationmembers
| Champ            | Type     | Contraintes              | Description |
|------------------|----------|--------------------------|-------------|
| _id              | ObjectId | PK auto                  | Identifiant |
| conversationId   | ObjectId | ref Conversation, required, indexed | Conversation rattachée |
| userId           | ObjectId | ref User, required, indexed | Membre |
| role             | String   | enum, default MEMBER     | OWNER \| MEMBER |
| timestamps       | Date     | auto                     | Création / mise à jour |

### Collection : messages
| Champ            | Type     | Contraintes                  | Description |
|------------------|----------|------------------------------|-------------|
| _id              | ObjectId | PK auto                      | Identifiant |
| conversationId   | ObjectId | ref Conversation, required, indexed | Conv parente |
| senderId         | ObjectId | ref User, required           | Expéditeur |
| content          | String   | required                     | Texte du message |
| contentType      | String   | default "TEXT"               | TEXT (extensible) |
| status           | String   | enum, default SENT           | SENT \| BLOCKED |
| isReported       | Boolean  | default false                | Au moins un Report existe |
| timestamps       | Date     | auto                         | Timestamps |

### Collection : reports
| Champ        | Type     | Contraintes              | Description |
|--------------|----------|--------------------------|-------------|
| _id          | ObjectId | PK auto                  | Identifiant |
| messageId    | ObjectId | ref Message, required    | Message signalé |
| reportedBy   | ObjectId | ref User, required       | Auteur du signalement |
| reason       | String   | required                 | Motif libre |
| timestamps   | Date     | auto                     | Timestamps |

## 4. Index prévus

- `users.phone` — unique sparse (recherche par OTP)
- `users.username` — unique
- `channels.topic` — unique
- `conversations.dmKey` — unique sparse (déduplication des DM)
- `conversationmembers.(conversationId, userId)` — compound unique
  (un user ne peut être deux fois dans la même conv)
- `messages.conversationId` — pour le fetch historique d'une conv
- `messages.createdAt` — pour le tri chronologique
- `reports.messageId` — pour retrouver tous les reports d'un message

## 5. Anti-patterns évités (justification)

- ✅ **Pas de table fourre-tout** : 6 collections distinctes avec
  responsabilité claire.
- ✅ **Pas de valeurs multiples dans un champ** : `ConversationMember`
  est une collection séparée, pas un array `members[]` dans
  Conversation (permet d'indexer, requêter, et scale).
- ✅ **Auth, profil, rôle séparés** : sur SafeChat, le rôle est
  suffisamment simple pour rester sur `User.role`. Si on ajoute
  des permissions fines par channel plus tard, on dénormalisera.
- ✅ **Timestamps partout** : tous les schemas Mongoose ont
  `{ timestamps: true }`.
- ✅ **IDs opaques** : ObjectId Mongo (≠ auto-incrément SQL), pas
  d'énumération possible des ressources publiques.

## 6. Dette acceptée sur la BDD (détail dans 07)

- ❌ **Pas de soft delete** au MVP : suppression hard. À ajouter en V2
  pour audit et récupération.
- ❌ **Pas d'audit log** : pas de trace de qui a bloqué quel message,
  ni de promotion de rôles. À ajouter en V1.1 pour la modération.