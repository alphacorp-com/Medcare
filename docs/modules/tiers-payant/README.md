# Tiers payant

Prise en charge des soins par un **organisme payeur** (CNPS, assureur, mutuelle, employeur…) ou
par un **programme de gratuité**, puis recouvrement de la part de l'organisme par **bordereau**.

- **Utilisateurs** : facturation, caisse, direction ; administrateur pour les organismes et les
  programmes.
- **Où** :
  - Paramètres → **Prises en charge** : types d'assurance, **Organismes et conventions**,
    **Programmes de gratuité** (administrateur) ;
  - fiche patient → onglet **Tiers payant** : adhésions, bons, gratuités ;
  - Facturation → **Créances et bordereaux** : bordereaux, règlements.
- **Permission** : `MODULE_BILLING`.
  - Inscrire à une gratuité, la lever et rembourser un organisme exigent `validate`.
  - Les organismes, conventions et programmes se modifient par un administrateur ; le personnel de
    facturation peut les consulter.

---

## Notions

| Notion | Explication |
|---|---|
| **Organisme payeur** | CNPS, assureur, mutuelle, employeur… Désactiver un organisme suspend ses conventions |
| **Convention** | Contrat avec un organisme : taux par défaut, taux par famille d'actes, application de la **nomenclature** (taux de PEC propre à chaque acte), plafond par facture, plafond annuel, bon de prise en charge obligatoire (au-delà d'un seuil éventuel), limite d'âge des enfants, dates de validité |
| **Adhésion** | Contrat d'une famille sous une convention : n° d'adhérent (unique dans la convention), titulaire (patient ou non), employeur, dates |
| **Bénéficiaire** | Patient couvert par une adhésion : **titulaire**, **conjoint**, **enfant** ou **autre**. Un bénéficiaire n'est pas forcément le titulaire |
| **Bon de prise en charge** | Autorisation préalable de l'organisme : n°, montant autorisé, validité, séjour éventuel |
| **Gratuité** | Programme qui paie un pourcentage de certaines lignes (familles d'actes, actes, articles), pour une population définie (âge, sexe, grossesse) ; **automatique** ou sur **inscription** (indigents…) |
| **Bordereau** | Lot de factures réclamées à un organisme pour une période |
| **Familles d'actes** | Consultation, laboratoire, imagerie, pharmacie, hospitalisation, chirurgie, maternité, autre |

## Comment une ligne est répartie

Pour chaque ligne de facture, dans cet ordre :

1. **Gratuité** : le programme applicable le plus généreux paie son pourcentage de la ligne.
2. **Organisme** : il paie son taux sur le reste. Le taux appliqué est, par ordre de priorité :
   - le taux de **nomenclature** de l'acte, si la convention applique la nomenclature et que l'acte
     en a un ;
   - sinon, le taux de la **famille d'actes** ;
   - sinon, le **taux par défaut** de la convention.
3. **Patient** : il paie le reste (ticket modérateur).

Puis, sur l'ensemble de la facture, la part organisme est limitée par :

- le **bon de prise en charge**, s'il est exigé : sans bon valide, aucune part organisme ;
- le **plafond par facture** ;
- ce qui reste des **plafonds annuels** du bénéficiaire et de la **famille** (titulaire et ayants
  droit partagent le plafond de l'adhésion) ;
- le **montant autorisé** du bon.

### Quand un bénéficiaire est-il couvert ?

Le jour de l'acte, toutes ces conditions doivent être remplies :

- sa ligne d'adhésion est valide (dates, non retirée) ;
- l'adhésion elle-même est valide : un ayant droit ne survit jamais à l'adhésion du titulaire ;
- la convention et l'organisme sont actifs, et la convention est en vigueur ;
- un **enfant** est plus jeune que la **limite d'âge** de la convention.

Sinon, la facture indique la raison (couverture invalide, limite d'âge dépassée, bon requis,
plafond atteint…).

---

## 👤 Procédures

### Configurer un organisme et sa convention (administrateur)
1. Paramètres → **Organismes et conventions** → **Nouvel organisme** : code, nom, type d'assurance,
   contact, téléphone, e-mail, adresse.
2. **Nouvelle convention** sur cet organisme :
   - code, nom, **taux par défaut** ;
   - **taux par famille** d'actes, application de la nomenclature ;
   - plafond par facture, plafond annuel ;
   - bon obligatoire et seuil ;
   - limite d'âge des enfants ;
   - dates de validité.
3. Pour la nomenclature : renseignez le **taux de PEC** de chaque acte dans Paramètres → Actes
   Médicaux.

Toute modification d'une convention **recalcule les factures encore ouvertes** (non soldées, non
réclamées).

### Couvrir un patient
Fiche patient → **Tiers payant** → **Ajouter une couverture**, de deux façons :

- **Nouvelle adhésion** : convention, **n° d'adhérent**, nom du titulaire (et le patient titulaire
  s'il est suivi dans l'établissement), employeur, dates.
- **Rejoindre une adhésion existante** : recherchez la convention et le n° d'adhérent ; MedCare
  retrouve l'adhésion de la famille. Un même n° d'adhérent n'est jamais créé deux fois.

Puis précisez la relation du patient (titulaire, conjoint, enfant, autre), son n° de
bénéficiaire et ses dates : elles doivent rester dans celles de l'adhésion. Les factures ouvertes
du patient sans couverture prennent celle-ci et sont recalculées.

Pour retirer ce patient de l'adhésion : **Terminer**. Pour clore l'adhésion de toute la famille :
**Clôturer l'adhésion**.

### Enregistrer un bon de prise en charge
Tiers payant → adhésion → **Ajouter un bon** : n°, montant autorisé, validité, séjour éventuel.
Les factures qui attendaient un bon le prennent automatiquement. Un bon peut être annulé.

### Gratuités

**Configurer** (administrateur) : Paramètres → **Programmes de gratuité** → code, nom, **taux**,
familles d'actes, actes ou articles visés, éligibilité (**automatique** ou **sur inscription**),
âge minimum et maximum en mois, sexe, grossesse uniquement, dates.

- Un programme **automatique** (par exemple, enfants de moins de 5 ans) s'applique tout de suite
  aux factures ouvertes des patients concernés.
- Un programme **sur inscription** (par exemple, indigents) demande d'inscrire chaque patient :
  fiche patient → Tiers payant → **Attribuer une exemption** → programme, dates, **motif obligatoire**. Exige
  `validate` ; c'est tracé au journal d'audit. **Révoquer** une exemption demande aussi un motif.

### Bordereaux et règlements

Facturation → **Créances et bordereaux** :
- **Créances par organisme** : à réclamer, réclamé, réglé, rejeté, reste dû.

Cycle d'un bordereau :
```
Brouillon ──Transmettre──► Transmis ──règlements / rejets──► Partiellement réglé ──► Soldé ──Clôturer──► Clôturé
```

1. **Nouveau bordereau** : organisme, période, puis **Créer le brouillon**. MedCare propose les **factures éligibles**. Ajoutez
   ou retirez des factures tant que le bordereau est en brouillon ; un brouillon peut être
   supprimé, ce qui libère ses factures.
2. **Transmettre** : le bordereau est figé. **Exporter (PDF)** produit le bordereau de prise en
   charge à envoyer, avec les visas ; un export CSV est aussi disponible.
3. **Enregistrer un règlement** reçu de l'organisme : montant, date, mode (virement, chèque,
   espèces, Mobile Money, autre), référence, bordereau. Sans affectation précise, le montant solde
   d'abord les factures les plus anciennes.
4. **Rejet** d'une partie d'une facture par l'organisme : montant, motif, et choix entre **passer
   en perte** ou **refacturer au patient** (il le doit alors sur sa facture).
5. Corrections possibles tant que le bordereau n'est pas clôturé :
   - annuler un rejet (l'organisme paie finalement) ;
   - annuler une affectation (mauvaise facture) ;
   - **affecter le reliquat** d'un règlement ;
   - **rembourser l'organisme** d'une partie non affectée (`validate`) ;
   - annuler un règlement saisi par erreur (s'il n'est ni affecté ni remboursé).
6. **Clôturer** quand plus rien n'est dû.

---

## Règles

- Une facture n'est réclamée **qu'une fois**. La partie rejetée d'une facture est corrigée sur la
  même ligne de bordereau.
- Deux factures d'une même famille ne peuvent pas consommer le même plafond en même temps : les
  adhésions sont verrouillées pendant le calcul.
- Une facture soldée ou incluse dans un bordereau n'est plus recalculée quand les conditions
  changent.
- Tout est cloisonné à l'établissement de la session, et les actions financières sont tracées.

## 🛠️ Repères techniques

| Besoin | Route / fichier |
|---|---|
| Organismes, conventions, programmes | `/api/v1/coverage/payers`, `/agreements`, `/programs` |
| Adhésions | `/api/v1/coverage/policies` |
| Couverture d'un patient, bons, gratuités | `/api/v1/patients/[id]/coverage`, `/coverage/[coverageId]/authorizations`, `/exemptions` |
| Bordereaux | `/api/v1/billing/claims`, `/claims/eligible`, `/claims/[id]` |
| Rejets et annulations | `/api/v1/billing/claims/[id]/items/[itemId]/rejection`, `/rejections/[rejectionId]/reversal` |
| Règlements des organismes | `/api/v1/billing/payer-payments`, `/[id]/allocations`, `/[id]/refunds`, `/api/v1/billing/payer-allocations/[id]/reversal` |
| Calcul de la répartition | `lib/coverage/compute.ts` (pur, testé) |
| Chargement et verrous | `lib/coverage/apply.ts` |
| Validité d'un bénéficiaire | `lib/coverage/validity.ts` |
| Adhésions, bordereaux, recalcul | `lib/coverage/policies.ts`, `lib/coverage/claims.ts`, `lib/coverage/recalc.ts` |
