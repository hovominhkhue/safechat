# ADR-004 : Frontend en vanilla JS + Tailwind CDN au lieu de React/Vue

**Date :** 2026-05-20
**Statut :** Accepté
**Décideurs :** Équipe SafeChat

## Contexte
Le projet a un MVP à livrer rapidement avec un backend déjà bien
avancé. Le frontend sert principalement à démontrer le bon
fonctionnement du backend lors de la soutenance (DoD : 2 onglets,
chat temps réel).

## Options envisagées
1. React (CRA ou Vite)
2. Vue.js 3
3. Vanilla JS + Tailwind via CDN
4. HTMX ou Alpine.js

## Décision
Vanilla JS + Tailwind via CDN, code unique dans frontend/app.js,
servi en static par Express.

## Justification
- Aucun build step : pas de npm install, pas de webpack/vite, pas
  de pipeline frontend
- Courbe d'apprentissage zéro : JavaScript standard
- Démarrage instantané : `docker compose up` lance tout, y compris le frontend
- Suffisant pour démontrer la DoD (chat temps réel)
- Réduit le risque projet : pas d'erreurs de build, de versions
  incompatibles, ou de bundler à débugger en plus du backend

## Conséquences
### Positives
- ✅ Stack minimaliste, lisible
- ✅ Un seul process Docker (le backend) sert frontend + API + WebSocket
- ✅ Pas de CORS à gérer (même origine)

### Négatives / risques
- ⚠️ Tailwind via CDN est marqué "not for production" — à
  remplacer par un vrai build PostCSS+purge avant ouverture
  publique (D-14 dans le registre de dette)
- ⚠️ Pas de typage (TypeScript) : à introduire si l'équipe
  grandit ou si le front devient complexe
- ⚠️ Pas de framework reactive : le re-render manuel des listes
  scale mal au-delà de quelques centaines d'éléments
