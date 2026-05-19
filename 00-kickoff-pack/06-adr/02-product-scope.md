# 02 — Product Scope — SafeChat

## 1. Backlog priorisé (MoSCoW)

### MUST (MVP)
- US-01 : En tant qu'utilisateur, je veux m'authentifier via téléphone
  + OTP, afin d'accéder à l'application sans créer de mot de passe.
- US-02 : En tant qu'utilisateur connecté, je veux récupérer mes infos
  de compte, afin de vérifier mon identité dans l'app.
- US-03 : En tant qu'utilisateur, je veux voir la liste des channels
  techniques disponibles, afin de choisir celui qui m'intéresse.
- US-04 : En tant qu'utilisateur, je veux rejoindre un channel, afin
  de participer aux discussions.
- US-05 : En tant que membre d'un channel, je veux envoyer un message,
  afin de contribuer à la discussion.
- US-06 : En tant que membre d'un channel, je veux recevoir les messages
  en temps réel, afin d'avoir une vraie expérience de chat.
- US-07 : En tant qu'utilisateur, je veux consulter l'historique des
  messages d'un channel, afin de suivre le contexte.
- US-08 : En tant qu'utilisateur, je veux démarrer une conversation
  privée (DM) avec un autre utilisateur, afin d'échanger en 1-1.
- US-09 : En tant qu'utilisateur, je veux signaler un message
  inapproprié, afin que les modérateurs puissent agir.
- US-10 : En tant que modérateur, je veux voir les messages signalés
  et bloquer ceux qui sont problématiques.

### SHOULD (V1.1)
- US-20 : En tant qu'utilisateur, je veux créer un groupe privé
  avec plusieurs membres, afin de discuter à plusieurs hors channel.
- US-21 : En tant qu'admin, je veux promouvoir un utilisateur en
  modérateur, afin de déléguer la modération.
- US-22 : En tant qu'utilisateur, je veux voir qui est connecté
  dans un channel, afin de savoir avec qui je discute.
- US-23 : En tant qu'utilisateur, je veux me déconnecter proprement,
  afin de protéger mon accès sur un poste partagé.

### COULD (si temps)
- US-30 : Recherche dans l'historique des messages.
- US-31 : Édition / suppression de ses propres messages.
- US-32 : Indicateur "X est en train d'écrire…".

### WON'T (hors scope assumé, MVP)
- Appels vocaux ou vidéo
- Upload de fichiers / images
- Notifications push (mobile / desktop)
- Vrai envoi de SMS pour l'OTP (resté simulé en MVP)
- Authentification OAuth (Google, GitHub…)
- Application mobile native (web responsive uniquement)
- Multi-langue (français uniquement au MVP)

## 2. Définition du MVP
- Objectif unique : permettre à des utilisateurs de discuter en temps
  réel dans des channels techniques thématiques, avec une modération
  basique fonctionnelle.
- Critère de mise en prod : `docker compose up --build` lance backend
  + Mongo + frontend, on peut s'inscrire, rejoindre un channel,
  échanger des messages en temps réel, et signaler un message.

## 3. Liste OUT (à brandir face aux ajouts opportunistes)
- Upload de fichiers — raison : complexité (stockage, sécurité, scan)
  hors budget MVP, prévu V2 avec object storage type S3.
- Vrai SMS pour OTP — raison : coût (Twilio) et complexité non
  nécessaires pour démontrer le flow d'auth ; OTP simulé suffit en MVP.
- App mobile native — raison : un client web responsive couvre 100 %
  des besoins MVP, native = double effort dev.
- OAuth — raison : l'OTP simulé répond déjà à l'objectif d'auth simple,
  OAuth ajouterait une dépendance externe sans valeur pour le MVP.
- Appels voix/vidéo — raison : WebRTC = projet à part entière, hors
  périmètre messagerie texte.