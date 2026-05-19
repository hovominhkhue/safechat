# ADR-002 : OTP simulé (code fixe) au lieu d'un vrai SMS au MVP

**Date :** 2026-05-15
**Statut :** Accepté
**Décideurs :** Équipe SafeChat

## Contexte
SafeChat doit s'authentifier par téléphone + OTP, ce qui démontre le
flow d'auth sans mot de passe. Le projet est un MVP école destiné à
une démo, pas à une mise en production grand public au sortir du
développement.

## Options envisagées
1. **Vrai SMS via Twilio** (ou Vonage, Brevo SMS…)
2. **Magic link par email** (SendGrid / Mailtrap)
3. **OTP simulé** : code fixe `123456` stocké dans `.env`
4. **Authentification password classique** (bcrypt)

## Décision
OTP simulé : la route `/auth/request-otp` ne contacte aucun service
externe. La route `/auth/verify-otp` vérifie que l'OTP fourni est
égal à `OTP_FAKE_CODE` (variable `.env`, valeur dev `123456`).

## Justification
- **Coût** : Twilio facture chaque SMS, non viable pour un projet école
- **Pas de dépendance externe** : la démo fonctionne hors-ligne, dans
  un wifi école, sans clé API à configurer
- **Le flow d'auth complet est démontré** : génération du JWT, header
  Authorization, route protégée `/auth/me` — la partie sensible est là
- **Réversibilité** : la couche métier (route, controller) ne change
  pas le jour où on branche un vrai SMS ; seul l'envoi change

## Conséquences

### Positives
- ✅ Aucun setup tiers requis pour faire tourner SafeChat
- ✅ Tests reproductibles : l'OTP est toujours `123456`
- ✅ Compatible avec démo offline ou jury sans connectivité externe

### Négatives / risques
- ❌ **Inutilisable en prod réelle** : n'importe qui pourrait deviner
  le code et usurper n'importe quel numéro
- ⚠️ À remplacer impérativement par Twilio ou équivalent avant
  ouverture publique (voir registre de dette 07)
- ⚠️ À documenter explicitement dans le README pour qu'aucun futur
  contributeur ne croie que c'est un vrai mécanisme de sécurité