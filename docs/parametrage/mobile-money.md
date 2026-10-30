# Mobile Money (Orange Money, MTN MoMo)

Configuration des paiements Mobile Money à la caisse. Réservé à l'**administrateur** :
**Paramètres → Intégrations Externes → Mobile Money**.

> **Affichage** : la section est visible sauf si le serveur est configuré avec
> `MOBILE_MONEY_SETTINGS_ENABLED=false` (lu au démarrage, sans reconstruire l'application). Masquée,
> ses routes de réglage sont fermées aussi ; les paiements déjà configurés continuent de fonctionner.

> Avant toute mise en production, lisez les prérequis et les limites en fin de page : aucun des
> deux opérateurs n'a encore été validé en conditions réelles.

---

## Fonctionnement

| Opérateur | Parcours de paiement | Confirmation |
|---|---|---|
| **Orange Money** | Paiement Web : le payeur valide sur la page de paiement Orange | Webhook Orange, ou interrogation du statut (`transactionstatus`) |
| **MTN MoMo** | API Collections : le payeur reçoit une demande (USSD) sur son téléphone | Interrogation du statut (`requesttopay`), ou webhook |

Le paiement reste **en attente** jusqu'à la confirmation. Une fois confirmé, il est appliqué à la
facture comme un paiement en espèces (voir [Facturation](../modules/facturation/README.md)).

**Sécurité de la confirmation.** Un webhook ou une interrogation n'est qu'un signal : MedCare
**relit toujours le statut auprès de l'opérateur** avant de solder un paiement, et ignore le
statut annoncé dans la requête reçue. Un appel forgé ne peut donc pas faire passer un paiement
pour réussi. Le passage « en attente » → « réussi » ne se produit qu'une fois, même si un webhook
et une interrogation arrivent en même temps : la facture n'est jamais créditée deux fois.

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
- L'URL de `transactionstatus` d'Orange suit la même forme que celle du paiement Web
  (`orange-money-webpay/{pays}/v1/…`), confirmée par le SDK de référence. Vérifiez-la dans la
  documentation officielle d'Orange de votre pays lors de l'ouverture du compte marchand.

## 🛠️ Repères techniques

| Élément | Fichier / route |
|---|---|
| Réglages | `GET/PUT /api/v1/settings/payments`, test : `POST /api/v1/settings/payments/test` |
| Clients API | `lib/payments/mobile-money/orange.ts`, `lib/payments/mobile-money/mtn.ts` |
| Chiffrement | `lib/payments/crypto.ts` |
| Initiation du paiement | `POST /api/v1/billing/[id]/payments` |
| Statut (interrogation) | `GET /api/v1/billing/payments/[id]/status` |
| Confirmation (statut relu chez l'opérateur, application unique) | `lib/payments/confirm.ts`, `lib/payments/mobile-money/status.ts` |
| Webhooks | `POST /api/v1/billing/webhooks/orange`, `POST /api/v1/billing/webhooks/mtn` |
