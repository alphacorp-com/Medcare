# Facturation

Les factures de MedCare se construisent **automatiquement**, acte par acte, au tarif de la grille
de l'établissement : la caisse **encaisse**, elle ne fixe jamais un prix. Le module gère aussi les
paiements (espèces, carte, virement, Mobile Money), la dérogation de paiement, les trop-perçus et
leurs remboursements.

- **Utilisateurs** : caissiers, comptabilité, direction.
- **Menu** : Facturation → **Factures**, **Créances et bordereaux**, **Grille tarifaire**
  (`/billing`).
- **Permission** : `MODULE_BILLING`.
  - lecture : consulter ;
  - modification : encaisser, déroger, changer la couverture d'une facture, annuler ;
  - **validation** : rembourser un patient.
  - La grille tarifaire se modifie **par un administrateur uniquement**.

Le tiers payant (organismes, conventions, gratuités, bordereaux) a son propre guide :
[Tiers payant](../tiers-payant/README.md).

---

## D'où viennent les lignes de facture

| Acte | Moment de la facturation | Type de ligne |
|---|---|---|
| Acte d'admission (consultation…) | À l'admission | Consultation |
| Consultation d'un séjour sans acte d'admission | À la signature de la note | Consultation |
| Hospitalisation | Caution à la demande (prix journalier de la salle × jours prévus), régularisée à la sortie | Hospitalisation |
| Examen de laboratoire ou de radiologie | **À la prescription** | Examen |
| Acte médical (cardiologie, anatomopathologie…) | À sa réalisation | Examen |
| Intervention chirurgicale | À la clôture | Chirurgie |
| Ordonnance | À la validation par la pharmacie (prix unitaire de l'article) | Délivrance pharmacie |
| CPN, accouchement | À l'enregistrement | Visite prénatale, accouchement |

- Les actes d'un même **séjour** s'ajoutent à la même facture tant qu'elle n'est pas soldée. Un
  acte ambulatoire (sans séjour) ouvre une nouvelle facture.
- Il n'existe **pas de création manuelle** de facture.
- Le montant de chaque ligne se répartit entre la **gratuité**, l'**organisme payeur** et le
  **patient** (voir [Tiers payant](../tiers-payant/README.md)).

## Statuts d'une facture

| Statut | Signification |
|---|---|
| Brouillon | Facture ouverte, rien d'encaissé |
| En attente de paiement | Part patient due |
| Partiellement payée | Une partie de la part patient est réglée |
| Payée | La part patient est entièrement réglée |
| Annulée | Facture annulée ; tout ce qui avait été payé devient un trop-perçu à rendre |

Seule la **part patient** conditionne les soins. La part de l'organisme est recouvrée séparément et
ne bloque jamais le patient.

---

## Écrans

### Factures (`/billing?tab=invoices`)
- Tuiles par statut et **solde restant** sur tout l'établissement ; filtre **Trop-perçus**.
- Recherche par patient, pagination.

### Détail d'une facture (`/billing/<id>`)
- Patient, séjour, lignes (avec la répartition gratuité / organisme / patient), sous-total, part
  organisme, part patient.
- Couverture appliquée, bon de prise en charge, bordereau éventuel.
- Historique des paiements, remboursements et transferts.
- Actions : **Enregistrer un Paiement**, **Autoriser sans paiement**, changer la couverture,
  annuler, **Imprimer la Facture**, **Imprimer le reçu** d'un paiement.

### Grille tarifaire (`/billing?tab=fee_schedule`)
Tarif de chaque acte par type (consultation, examen, chirurgie, délivrance, CPN, accouchement,
hospitalisation, autre). Les prix des actes médicaux, des examens et des salles se modifient de
préférence depuis leurs paramètres : la grille est synchronisée automatiquement (voir
[Paramétrage](../../parametrage/README.md#actes-tarifs-et-examens)).

---

## 👤 Procédures

### Encaisser un paiement
1. Ouvrez la facture (depuis la liste, la fiche patient ou un lien « Voir la facture »).
2. **Enregistrer un Paiement** → montant, **moyen de paiement**, référence facultative.
   - **Espèces, carte, virement bancaire** : enregistré immédiatement.
   - **Orange Money / MTN Mobile Money** : saisissez le n° de téléphone du payeur. Le paiement reste
     **en attente** jusqu'à la confirmation de l'opérateur ; l'écran affiche « En attente de
     confirmation… ». Voir [Mobile Money](../../parametrage/mobile-money.md).
3. Quand la part patient est entièrement réglée, la facture passe **Payée** et MedCare **libère
   automatiquement** ce qu'elle retenait :
   - le patient en attente entre dans la file de consultation ;
   - les examens deviennent réalisables ;
   - le lit réservé est attribué ;
   - l'ordonnance devient délivrable.
4. **Imprimer le reçu**.

La part d'un organisme ne s'encaisse **jamais** ici : elle est déduite par la couverture, puis
recouvrée par [bordereau](../tiers-payant/README.md#bordereaux-et-règlements).

### Autoriser les soins sans paiement (dérogation)
Pour un patient indigent ou sur décision de la direction : facture → **Autoriser sans paiement** →
**motif obligatoire**.
- Les soins retenus sont libérés : admission, examens, hospitalisation.
- La facture **reste due**.
- Le motif est inscrit dans les notes de la facture et dans le **journal d'audit**.

### Appliquer ou changer la couverture d'une facture
Facture → couverture : choisissez une adhésion du patient (ou aucune) et, si la convention l'exige,
un **bon de prise en charge**. La répartition est recalculée. C'est impossible une fois la facture
incluse dans un bordereau.

### Rembourser ou transférer un trop-perçu
Un trop-perçu apparaît quand le patient a payé plus que sa part :
- couverture ou gratuité appliquée après coup ;
- ligne retirée ;
- rejet d'un organisme annulé ;
- double paiement ;
- facture annulée.

Facture → bloc **Trop-perçu** → **Rembourser** ou **Transférer sur une autre facture** :
- **Rembourser** : montant, mode (espèces, Mobile Money, virement, carte), référence, **motif
  obligatoire**. Exige la permission `validate`.
- **Transférer** : montant, facture de destination (une autre facture ouverte du même patient),
  motif. Le transfert n'est pas compté comme une recette.

### Annuler une facture
Facture → **Annuler**. Ce qui avait été payé devient un trop-perçu à rembourser.

### Modifier un tarif (administrateur)
**Grille tarifaire → Nouveau Tarif** ou modification d'une ligne : type d'acte, code, libellé, prix,
actif / inactif.

---

## Règles

- Les montants sont recalculés côté serveur à chaque changement (ligne, couverture, paiement,
  rejet) ; une facture soldée ou réclamée à un organisme ne bouge plus quand les conditions de
  couverture changent.
- Un paiement Mobile Money confirmé **après** l'annulation de la facture ne la rouvre pas : le
  montant devient remboursable.

## Limites connues

- **Mobile Money** : Orange Money n'a jamais été validé de bout en bout (compte marchand réel
  nécessaire) ; MTN n'a été testé qu'en environnement de test.
- ⚠️ **Sécurité** : les webhooks de confirmation Mobile Money ne vérifient pas encore le statut
  auprès de l'opérateur (voir [Audit de sécurité](../../securite/AUDIT_2026-09.md)). Ne les activez
  pas en production avant correction.

## 🛠️ Repères techniques

| Besoin | Route / fichier |
|---|---|
| Liste des factures (et filtre trop-perçus) | `GET /api/v1/billing` |
| Détail, couverture, annulation | `GET/PATCH /api/v1/billing/[id]` |
| Paiement | `POST /api/v1/billing/[id]/payments` ; statut Mobile Money : `GET /api/v1/billing/payments/[id]/status` |
| Dérogation | `POST /api/v1/billing/[id]/waive` |
| Remboursement / transfert | `POST /api/v1/billing/[id]/refunds` |
| Grille tarifaire | `/api/v1/billing/fee-schedule` |
| Génération des lignes, recalcul | `lib/billing/suggestCharge.ts` |
| Règle « payer d'abord », libération | `lib/billing/paymentGate.ts`, `lib/billing/release.ts`, `lib/billing/applyPayment.ts` |
| Trop-perçus | `lib/billing/refunds.ts` |
