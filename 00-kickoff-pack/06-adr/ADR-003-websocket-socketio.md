# ADR-003 : Socket.IO pour le temps réel (au lieu de polling ou SSE)

**Date :** 2026-05-15
**Statut :** Accepté
**Décideurs :** Équipe SafeChat

## Contexte
SafeChat est par définition une app de messagerie temps réel.
L'utilisateur doit voir les messages arriver instantanément sans
recharger la page. Une vraie expérience chat impose un canal
bidirectionnel et persistant entre client et serveur.

## Options envisagées
1. **HTTP long polling** (requête bloquante régulière)
2. **Server-Sent Events (SSE)** (canal serveur→client only)
3. **WebSocket natif (lib `ws`)**
4. **Socket.IO** (lib qui encapsule WebSocket avec fallbacks)
5. **Pusher / Ably** (BaaS temps réel managé)

## Décision
Socket.IO côté serveur (paquet `socket.io`) et côté client
(`socket.io-client`), sur le même port que l'API REST (3001), avec
gestion de rooms par conversation (`conversation:<id>`).

## Justification
- **Bidirectionnel** : le client envoie (`message:send`), le serveur
  diffuse (`message:new`). SSE ne couvre que la moitié.
- **Rooms natives** : Socket.IO gère le concept de "salle" — parfait
  pour brodcast à tous les membres d'une conversation
- **Fallbacks intégrés** : si WebSocket est bloqué (proxy, antivirus
  école), Socket.IO retombe sur long-polling automatiquement
- **Adoption massive** : doc abondante, exemples partout, débogage
  facile (boring tech)
- **Pas de coût externe** : tourne dans le même process Node.js,
  pas de service tiers à payer (vs Pusher)
- **Auth socket native** : middleware `io.use()` permet de vérifier
  le JWT au handshake, comme un middleware Express

## Conséquences

### Positives
- ✅ Latence < 100 ms sur réseau local pour la diffusion d'un message
- ✅ Code lisible : un événement = une fonction (`message:send` →
  handler clair)
- ✅ Authentification cohérente avec le REST (même `JWT_SECRET`)

### Négatives / risques
- ⚠️ **Serveur stateful** : si on scale horizontalement (plusieurs
  instances Node), il faut un adapter Redis pour Socket.IO. Hors
  scope MVP.
- ⚠️ **Pas serverless friendly** : exclut Vercel Functions ou AWS
  Lambda pour héberger le backend. Mais on est en VM / conteneur,
  donc pas un problème actuel.
- ⚠️ **Surface d'attaque dédiée** : il faut penser à valider chaque
  event aussi rigoureusement qu'une route REST (ne pas faire confiance
  au socket parce qu'il est "interne")