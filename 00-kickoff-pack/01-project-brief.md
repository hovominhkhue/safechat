# 01 — Project Brief — SafeChat

## 1. Problème
Les développeurs et étudiants en tech ont besoin d'échanger en temps
réel autour de sujets techniques (IA, backend, frontend, DevOps), mais
les outils existants soit mélangent vie pro et perso (Discord, WhatsApp),
soit sont fermés à une entreprise (Slack), soit ne sont pas catégorisés
par sujet technique.

## 2. Cible
- Utilisateur principal : étudiants et développeurs en formation tech
- Pain actuel : pas d'espace de discussion dédié, catégorisé par sujet
  technique, ouvert et léger

## 3. Solution proposée (haut niveau)
Une messagerie temps réel orientée développeurs avec authentification
simple (OTP simulé), conversations privées (DM), groupes, et channels
publics par thématique technique. Modération basique intégrée pour
filtrer les messages problématiques.

## 4. Contexte projet
- Type : projet école (Master)
- Équipe : 1 développeur
- Délai cible : MVP en 2 semaines
- Stack imposée / choisie : Node.js, MongoDB, WebSocket, Docker

## 5. Contraintes non négociables
- Doit être lancé avec une seule commande Docker Compose
- Authentification fonctionnelle (même si simulée pour le MVP)
- Messages persistés en base
- Démonstration possible en local sans dépendance cloud

## 6. Critère de succès
À la soutenance : un utilisateur peut se connecter via téléphone + OTP,
rejoindre un channel technique, échanger en temps réel avec d'autres
utilisateurs, et signaler un message inapproprié — le tout via une
unique commande `docker compose up`.