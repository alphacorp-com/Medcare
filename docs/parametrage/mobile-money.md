# Mobile Money (Orange Money, MTN MoMo)

Configuration des paiements Mobile Money à la caisse. Réservé à l'**administrateur** :
**Paramètres → Intégrations Externes → Mobile Money**.

> ⚠️ **Avant toute mise en production**, lisez les limites en fin de page : les webhooks de
> confirmation ne sont pas encore sécurisés (voir l'[audit de sécurité](../securite/AUDIT_2026-09.md)).

---

## Fonctionnement

| Opérateur | Parcours de paiement | Confirmation |
|---|---|---|
| **Orange Money** | Paiement Web : le payeur valide sur la page de paiement Orange | Par **webhook** Orange uniquement (pas d'interrogation de statut possible) |
| **MTN MoMo** | API Collections : le payeur reçoit une demande (USSD) sur son téléphone | Par **interrogation** du statut (fonctionne sans webhook) ou par webhook |

Le paiement reste **en attente** jusqu'à la confirmation. Une fois confirmé, il est appliqué à la
facture comme un paiement en espèces (voir [Facturation](../modules/facturation/README.md)).

## 👤 Configurer un opérateur

1. **Paramètres → Intégrations Externes**, section **Mobile Money**.
2. **Orange Money** : identifiant client, secret client, clé marchand, pays, activé.
3. **MTN MoMo** : URL de l'API, identifiant utilisateur API, clé API, clé d'abonnement,
   environnement cible (sandbox ou production), activé.
4. **Enregistrer**, puis **Tester** : MedCare tente d'obtenir un jeton d'accès avec les
   identifiants enregistrés.

Les secrets sont **chiffrés** en base (clé dérivée de `NEXTAUTH_SECRET`) et ne sont jamais renvoyés
au navigateur après enregistrement. Changer `NEXTAUTH_SECRET` rend ces secrets illisibles : il faut
alors les ressaisir.

## Prérequis

- **Orange Money** : un **compte marchand réel** (procédure KYC de 5 à 10 jours ouvrés) ; Orange ne
  propose pas d'environnement de test en libre-service.
- **MTN MoMo** : un compte sur le portail développeur MTN (sandbox gratuit), puis un compte de
  production.
- **Webhooks** : un domaine **HTTPS public**. Ils sont inutilisables en développement local ; MTN
  reste utilisable par interrogation.

## Limites connues

- Orange Money n'a **jamais été validé de bout en bout** ; MTN n'a été testé qu'en sandbox.
- 🔴 Les webhooks `/api/v1/billing/webhooks/orange` et `/mtn` **font confiance au statut envoyé
  dans la requête**, sans le vérifier auprès de l'opérateur. Quelqu'un qui connaît la référence
  d'un paiement en attente pourrait le faire passer « réussi » sans payer, ce qui solde la facture
  et débloque la délivrance de médicaments. Correctif prévu : revérifier le statut auprès de
  l'opérateur, comme le fait déjà l'interrogation MTN.

## 🛠️ Repères techniques

| Élément | Fichier / route |
|---|---|
| Réglages | `GET/PUT /api/v1/settings/payments`, test : `POST /api/v1/settings/payments/test` |
| Clients API | `lib/payments/mobile-money/orange.ts`, `lib/payments/mobile-money/mtn.ts` |
| Chiffrement | `lib/payments/crypto.ts` |
| Initiation du paiement | `POST /api/v1/billing/[id]/payments` |
| Statut (interrogation) | `GET /api/v1/billing/payments/[id]/status` |
| Webhooks | `POST /api/v1/billing/webhooks/orange`, `POST /api/v1/billing/webhooks/mtn` |
