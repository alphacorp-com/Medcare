# VIH, PTME, hépatites et IST

Suivi des personnes vivant avec le VIH sous traitement antirétroviral (file active), dépistages
(VIH, syphilis, hépatites, IST), charges virales, enfants exposés, PTME et hépatites B et C.

- **Permission** : sous-module **`MODULE_HIV`** (en plus de `MODULE_DISEASE_PROGRAMS`). Ces
  données sont **hautement sensibles** : n'accordez ce droit qu'au personnel qui en a besoin.
- **Où** :
  - fiche patient → *Programmes* → **dossier VIH** (saisie) ;
  - Programmes de Santé → **VIH / Hépatites** (vue programme, rapports).
- **Traçabilité** : chaque ouverture du dossier VIH d'un patient est inscrite au journal d'audit.

---

## Vue programme (onglet VIH / Hépatites)

- **File active TARV** : chaque patient inscrit, sa dernière visite et ses **jours de retard** par
  rapport au prochain rendez-vous. Un patient est **perdu de vue** à partir de 90 jours de retard.
- **Registre de dépistage** du mois.
- **Enfants exposés** : enfants nés de mères séropositives, avec leurs PCR et sérologies.
- **Cas d'hépatite**.
- **Rapport RMA3 VIH** : tableaux du mois avec le détail par âge et par sexe (agrégats
  uniquement).

## 👤 Procédures (dossier VIH du patient)

### Enregistrer un dépistage fait hors laboratoire
Test rapide en CPN, en salle d'accouchement, au CDV… :
- type de test : VIH, PCR VIH, syphilis, AgHBs, VHC, VHD, chlamydia, mycoplasme, gonocoque,
  autre IST ;
- résultat et **porte d'entrée** (cas index, urgences, CPN, maternité, pédiatrie, CDV, TB, IST,
  PF, communauté…).

Les tests faits **au laboratoire** arrivent automatiquement dans le registre à leur validation.

Suivi d'un test : date de remise du résultat et, pour un résultat positif, date du traitement
(syphilis, IST). Le résultat lui-même ne se modifie jamais : un test erroné s'enregistre à nouveau.

### Inscrire un patient dans la file active
- date de début du TARV, date de diagnostic, porte d'entrée ;
- transfert entrant éventuel, grossesse liée.

Une seule inscription par patient.

### Enregistrer une visite (dispensation d'ARV)
- schéma thérapeutique, nombre de jours dispensés, prochain rendez-vous ;
- dépistage de la tuberculose : symptômes, test, confirmation, traitement ;
- traitement préventif à l'isoniazide (TPI).

Seule une inscription active reçoit des visites.

### Changer le statut d'un patient
Actif, transféré (dans le pays ou à l'étranger), décédé, arrêt. Un **décès** est aussi enregistré
sur la fiche du patient.

### Dépannage d'ARV
Patient suivi dans un autre site, servi une fois : schéma, jours dispensés, site d'origine. Le
patient **n'entre pas** dans la file active de l'établissement.

### Charges virales
Programme (VIH, VHB, VHC), date de prélèvement, valeur ou « indétectable », grossesse liée. Une
charge virale faite au laboratoire arrive automatiquement à sa validation.

### Enfant exposé
Suivi de l'enfant (un par enfant) : PCR, sérologie, issue.

### Hépatite B ou C
Un cas par patient et par type :
- diagnostic, delta, éligibilité, traitement ;
- guérison, complications, décès.

### Statut PTME d'une grossesse
Depuis la grossesse :
- séropositivité VIH connue à l'entrée, déjà sous TARV, AgHBs connu positif ;
- source de référence communautaire.

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Dossier VIH d'un patient (audité) | `GET /api/v1/hiv/patients/[patientId]` |
| Dépistages | `/api/v1/hiv/screening-tests` |
| File active, visites, statut | `/api/v1/hiv/enrolments`, `/[id]/visits`, `PATCH /[id]` |
| Dépannage d'ARV | `POST /api/v1/hiv/emergency-supplies` |
| Charges virales | `POST /api/v1/hiv/viral-loads` |
| Enfants exposés, hépatites | `/api/v1/hiv/exposed-infants`, `/api/v1/hiv/hepatitis-cases` |
| PTME d'une grossesse | `PUT /api/v1/hiv/pregnancies/[id]` |
| Rapport du mois | `GET /api/v1/hiv/rma3?month=AAAA-MM` |
| Lien laboratoire → registres | `lib/hiv/lab-link` |
| Confidentialité des résultats | `lib/hiv/confidential-results.ts` |
